import ffmpeg from 'fluent-ffmpeg';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { ProjectConfig, Clip, SourceFile } from '@video-editor/shared';
import { DATA_DIR } from '@video-editor/shared';

interface ExportProgress {
  percent: number;
  status: 'pending' | 'processing' | 'done' | 'error';
  error?: string;
}

export interface ExportCallbacks {
  onProgress?: (percent: number) => void;
  onDone?: () => void;
  onError?: (error: string) => void;
}

const exportJobs = new Map<string, ExportProgress>();

export function getExportStatus(projectId: string): ExportProgress {
  return exportJobs.get(projectId) ?? { percent: 0, status: 'pending' };
}

export function getExportPath(projectId: string): string {
  return join(DATA_DIR, projectId, 'export.mp4');
}

function probeHasAudio(filePath: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(err);
      resolve(data.streams.some((s) => s.codec_type === 'audio'));
    });
  });
}

export async function generateThumbnails(
  inputPath: string,
  outputDir: string,
  count: number,
  duration: number,
): Promise<void> {
  const maxTime = Math.max(0, duration - 0.1);
  for (let i = 0; i < count; i++) {
    const time = count === 1 ? 0 : (maxTime * i) / (count - 1);
    const outputPath = join(outputDir, `thumb_${i + 1}.jpg`);
    await new Promise<void>((resolve, reject) => {
      const proc = spawn('ffmpeg', [
        '-ss',
        time.toFixed(2),
        '-i',
        inputPath,
        '-vframes',
        '1',
        '-vf',
        'scale=192:-2',
        '-y',
        outputPath,
      ]);
      proc.on('close', (code) =>
        code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`)),
      );
      proc.on('error', reject);
    });
  }
}

function parseTimemark(timemark: string): number {
  const parts = timemark.split(':').map(Number);
  if (parts.some((p) => isNaN(p))) return -1;
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

interface ClipInput {
  path: string;
  clip: Clip;
  source: SourceFile;
  hasAudio: boolean;
}

export async function startExport(
  config: ProjectConfig,
  callbacks?: ExportCallbacks,
): Promise<void> {
  const projectDir = join(DATA_DIR, config.id);
  const outputPath = getExportPath(config.id);

  const outDir = dirname(outputPath);
  if (!existsSync(outDir)) {
    await mkdir(outDir, { recursive: true });
  }

  exportJobs.set(config.id, { percent: 0, status: 'processing' });

  try {
    // Separate video-track clips and audio-track clips
    const videoTrackClips: ClipInput[] = [];
    const audioTrackClips: ClipInput[] = [];

    for (const track of config.timeline.tracks) {
      const trackType = (track as { type?: string }).type ?? 'video';
      for (const clip of track.clips) {
        const source = config.sources.find((s) => s.id === clip.sourceId);
        if (!source) continue;
        const inputPath = join(projectDir, source.path);
        const sourceType = (source as { type?: string }).type ?? 'video';

        if (trackType === 'audio') {
          audioTrackClips.push({ path: inputPath, clip, source, hasAudio: true });
        } else {
          const hasAudio = sourceType === 'video' ? await probeHasAudio(inputPath) : false;
          videoTrackClips.push({ path: inputPath, clip, source, hasAudio });
        }
      }
    }

    const sortedVideo = [...videoTrackClips].sort((a, b) => a.clip.timelineStart - b.clip.timelineStart);
    const sortedAudio = [...audioTrackClips].sort((a, b) => a.clip.timelineStart - b.clip.timelineStart);

    if (sortedVideo.length === 0 && sortedAudio.length === 0) {
      const error = 'No clips on timeline';
      exportJobs.set(config.id, { percent: 0, status: 'error', error });
      callbacks?.onError?.(error);
      return;
    }

    const { width, height } = config.resolution;
    const fps = config.fps;
    const args: string[] = ['-hide_banner'];
    const filterParts: string[] = [];
    let inputIndex = 0;

    // Add video track inputs
    for (const input of sortedVideo) {
      const sourceType = (input.source as { type?: string }).type ?? 'video';
      if (sourceType === 'image') {
        args.push('-loop', '1');
        const duration = input.clip.outPoint - input.clip.inPoint;
        args.push('-t', String(duration));
        args.push('-i', input.path);
      } else {
        args.push('-ss', String(input.clip.inPoint));
        args.push('-to', String(input.clip.outPoint));
        args.push('-i', input.path);
      }
      (input as ClipInput & { inputIdx: number }).inputIdx = inputIndex;
      inputIndex++;
    }

    // Add audio track inputs
    for (const input of sortedAudio) {
      args.push('-ss', String(input.clip.inPoint));
      args.push('-to', String(input.clip.outPoint));
      args.push('-i', input.path);
      (input as ClipInput & { inputIdx: number }).inputIdx = inputIndex;
      inputIndex++;
    }

    if (inputIndex === 0) {
      const error = 'No valid source files found';
      exportJobs.set(config.id, { percent: 0, status: 'error', error });
      callbacks?.onError?.(error);
      return;
    }

    // Build video concat filter — insert black gaps where there are no clips
    const concatVideoInputs: string[] = [];
    const hasVideoTrack = sortedVideo.length > 0;
    let concatSegmentCount = 0;
    let gapIndex = 0;

    if (hasVideoTrack) {
      let cursor = 0; // current timeline position

      for (let i = 0; i < sortedVideo.length; i++) {
        const input = sortedVideo[i] as ClipInput & { inputIdx: number };
        const idx = input.inputIdx;
        const clipDuration = input.clip.outPoint - input.clip.inPoint;

        // Insert black gap before this clip if needed
        const gapDuration = input.clip.timelineStart - cursor;
        if (gapDuration > 0.01) {
          const gvLabel = `gv${gapIndex}`;
          const gaLabel = `ga${gapIndex}`;
          filterParts.push(
            `color=c=black:s=${width}x${height}:r=${fps}:d=${gapDuration},format=yuv420p[${gvLabel}]`,
          );
          filterParts.push(`anullsrc=channel_layout=stereo:sample_rate=48000[${gaLabel}_raw]`);
          filterParts.push(`[${gaLabel}_raw]atrim=0:${gapDuration}[${gaLabel}]`);
          concatVideoInputs.push(`[${gvLabel}][${gaLabel}]`);
          concatSegmentCount++;
          gapIndex++;
        }

        // Video normalization
        const vLabel = `v${i}`;
        filterParts.push(
          `[${idx}:v:0]scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
            `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,` +
            `setsar=1,fps=${fps},format=yuv420p[${vLabel}]`,
        );

        // Audio for video clips
        const clipVolume = input.clip.volume ?? 1;
        let aLabel: string;
        if (input.hasAudio) {
          const volLabel = `va${i}`;
          let audioFilter = `[${idx}:a:0]aresample=48000`;
          if (clipVolume !== 1) {
            audioFilter += `,volume=${clipVolume}`;
          }
          if ((input.clip.fadeIn ?? 0) > 0) {
            audioFilter += `,afade=t=in:d=${input.clip.fadeIn}`;
          }
          if ((input.clip.fadeOut ?? 0) > 0) {
            const fadeOutStart = Math.max(0, clipDuration - input.clip.fadeOut);
            audioFilter += `,afade=t=out:st=${fadeOutStart}:d=${input.clip.fadeOut}`;
          }
          audioFilter += `[${volLabel}]`;
          filterParts.push(audioFilter);
          aLabel = volLabel;
        } else {
          aLabel = `sa${i}`;
          filterParts.push(`anullsrc=channel_layout=stereo:sample_rate=48000[${aLabel}_raw]`);
          filterParts.push(`[${aLabel}_raw]atrim=0:${clipDuration}[${aLabel}]`);
        }

        concatVideoInputs.push(`[${vLabel}][${aLabel}]`);
        concatSegmentCount++;
        cursor = input.clip.timelineStart + clipDuration;
      }

      filterParts.push(
        `${concatVideoInputs.join('')}concat=n=${concatSegmentCount}:v=1:a=1[outv][video_audio]`,
      );
    }

    // Build audio track mix
    const hasAudioTrack = sortedAudio.length > 0;
    if (hasAudioTrack) {
      // Process each audio track clip: apply volume, fade, and delay
      const audioMixInputs: string[] = [];
      for (let i = 0; i < sortedAudio.length; i++) {
        const input = sortedAudio[i] as ClipInput & { inputIdx: number };
        const idx = input.inputIdx;
        const clipVolume = input.clip.volume ?? 1;
        const clipDuration = input.clip.outPoint - input.clip.inPoint;
        const label = `at${i}`;

        let audioFilter = `[${idx}:a:0]aresample=48000`;
        if (clipVolume !== 1) {
          audioFilter += `,volume=${clipVolume}`;
        }
        if ((input.clip.fadeIn ?? 0) > 0) {
          audioFilter += `,afade=t=in:d=${input.clip.fadeIn}`;
        }
        if ((input.clip.fadeOut ?? 0) > 0) {
          const fadeOutStart = Math.max(0, clipDuration - input.clip.fadeOut);
          audioFilter += `,afade=t=out:st=${fadeOutStart}:d=${input.clip.fadeOut}`;
        }
        // Delay to position at timeline start (adelay takes milliseconds)
        const delayMs = Math.round(input.clip.timelineStart * 1000);
        if (delayMs > 0) {
          audioFilter += `,adelay=${delayMs}|${delayMs}`;
        }
        audioFilter += `[${label}]`;
        filterParts.push(audioFilter);
        audioMixInputs.push(`[${label}]`);
      }

      if (audioMixInputs.length === 1) {
        // Single audio clip — rename directly
        filterParts.push(`${audioMixInputs[0]}acopy[audio_track]`);
      } else {
        filterParts.push(
          `${audioMixInputs.join('')}amix=inputs=${audioMixInputs.length}:duration=longest:dropout_transition=0[audio_track]`,
        );
      }
    }

    // Final mix: combine video audio and audio track
    if (hasVideoTrack && hasAudioTrack) {
      filterParts.push(
        `[video_audio][audio_track]amix=inputs=2:duration=longest:dropout_transition=0[outa]`,
      );
      args.push('-filter_complex', filterParts.join(';'));
      args.push('-map', '[outv]', '-map', '[outa]');
    } else if (hasVideoTrack) {
      // Rename video_audio to outa
      filterParts.push(`[video_audio]acopy[outa]`);
      args.push('-filter_complex', filterParts.join(';'));
      args.push('-map', '[outv]', '-map', '[outa]');
    } else {
      // Audio only — generate black video
      const totalAudioDuration = sortedAudio.reduce((max, input) => {
        const end = input.clip.timelineStart + (input.clip.outPoint - input.clip.inPoint);
        return Math.max(max, end);
      }, 0);
      filterParts.push(
        `color=c=black:s=${width}x${height}:r=${fps}:d=${totalAudioDuration},format=yuv420p[outv]`,
      );
      args.push('-filter_complex', filterParts.join(';'));
      args.push('-map', '[outv]', '-map', '[audio_track]');
    }

    args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '23');
    args.push('-c:a', 'aac', '-b:a', '192k');
    args.push('-movflags', '+faststart');
    args.push('-shortest');
    args.push('-y', outputPath);

    const totalDuration = Math.max(
      sortedVideo.reduce((sum, i) => sum + (i.clip.outPoint - i.clip.inPoint), 0),
      sortedAudio.reduce((max, i) => {
        const end = i.clip.timelineStart + (i.clip.outPoint - i.clip.inPoint);
        return Math.max(max, end);
      }, 0),
    );

    await new Promise<void>((resolve, reject) => {
      const proc = spawn('ffmpeg', args);
      let stderr = '';

      proc.stderr.on('data', (data: Buffer) => {
        const line = data.toString();
        stderr += line;

        // Parse progress from stderr (ffmpeg outputs "time=HH:MM:SS.ss")
        const match = line.match(/time=(\d+:\d+:\d+\.\d+)/);
        if (match && totalDuration > 0) {
          const currentSeconds = parseTimemark(match[1]);
          if (currentSeconds >= 0) {
            const percent = Math.min(99, Math.round((currentSeconds / totalDuration) * 100));
            exportJobs.set(config.id, { percent, status: 'processing' });
            callbacks?.onProgress?.(percent);
          }
        }
      });

      proc.on('close', (code) => {
        if (code === 0) {
          exportJobs.set(config.id, { percent: 100, status: 'done' });
          callbacks?.onDone?.();
          resolve();
        } else {
          const lastLines = stderr.split('\n').filter(Boolean).slice(-5).join('\n');
          const error = `ffmpeg exited with code ${code}: ${lastLines}`;
          exportJobs.set(config.id, { percent: 0, status: 'error', error });
          callbacks?.onError?.(error);
          reject(new Error(error));
        }
      });

      proc.on('error', (err) => {
        exportJobs.set(config.id, { percent: 0, status: 'error', error: err.message });
        callbacks?.onError?.(err.message);
        reject(err);
      });
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    exportJobs.set(config.id, { percent: 0, status: 'error', error: message });
    callbacks?.onError?.(message);
  }
}
