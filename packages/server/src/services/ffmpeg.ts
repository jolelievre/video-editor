import ffmpeg from 'fluent-ffmpeg';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { ProjectConfig, Clip, SourceFile, TextClip } from '@video-editor/shared';
import { DATA_DIR } from '@video-editor/shared';
import { resolveFontPath } from './font-resolver.js';

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

const ADJACENT_THRESHOLD = 0.05;

function getClipDuration(c: Clip): number {
  return c.outPoint - c.inPoint;
}

function clipTimelineEnd(c: Clip): number {
  return c.timelineStart + getClipDuration(c);
}

/**
 * Build a volume expression that handles fade-in/out with adjacent clip volume transitions.
 * Uses ffmpeg's volume filter with eval=frame for per-frame volume calculation.
 * `t` is the time within the clip (0 to dur).
 */
function buildVolumeExpression(
  vol: number,
  fadeIn: number,
  fadeOut: number,
  dur: number,
  prevVol: number,
  nextVol: number,
): string {
  // If no fades and volume is 1, no filter needed
  if (fadeIn <= 0 && fadeOut <= 0 && vol === 1) return '';

  // Build expression parts
  // Default: clip volume
  // Fade in: lerp from prevVol to vol over fadeIn
  // Fade out: lerp from vol to nextVol over fadeOut
  const fadeOutStart = Math.max(0, dur - fadeOut);

  if (fadeIn > 0 && fadeOut > 0) {
    return `volume='if(lt(t,${fadeIn}),${prevVol}+(${vol}-${prevVol})*t/${fadeIn},if(gt(t,${fadeOutStart}),${vol}+(${nextVol}-${vol})*(t-${fadeOutStart})/${fadeOut},${vol}))':eval=frame`;
  } else if (fadeIn > 0) {
    return `volume='if(lt(t,${fadeIn}),${prevVol}+(${vol}-${prevVol})*t/${fadeIn},${vol})':eval=frame`;
  } else if (fadeOut > 0) {
    return `volume='if(gt(t,${fadeOutStart}),${vol}+(${nextVol}-${vol})*(t-${fadeOutStart})/${fadeOut},${vol})':eval=frame`;
  } else {
    return `volume=${vol}`;
  }
}

function findAdjacentVolumes(
  sorted: ClipInput[],
  index: number,
): { prevVol: number; nextVol: number } {
  let prevVol = 0;
  let nextVol = 0;
  if (index > 0) {
    const prev = sorted[index - 1];
    if (
      Math.abs(clipTimelineEnd(prev.clip) - sorted[index].clip.timelineStart) < ADJACENT_THRESHOLD
    ) {
      prevVol = prev.clip.volume ?? 1;
    }
  }
  if (index < sorted.length - 1) {
    const next = sorted[index + 1];
    if (
      Math.abs(clipTimelineEnd(sorted[index].clip) - next.clip.timelineStart) < ADJACENT_THRESHOLD
    ) {
      nextVol = next.clip.volume ?? 1;
    }
  }
  return { prevVol, nextVol };
}

function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, '\\\\\\\\')
    .replace(/'/g, "'\\\\\\''")
    .replace(/:/g, '\\\\:')
    .replace(/\[/g, '\\\\[')
    .replace(/\]/g, '\\\\]');
}

function collectTextClips(config: ProjectConfig): TextClip[] {
  const result: TextClip[] = [];
  for (const track of config.timeline.tracks) {
    if (track.type !== 'text') continue;
    for (const tc of track.textClips ?? []) {
      result.push(tc);
    }
  }
  return result.sort((a, b) => a.timelineStart - b.timelineStart);
}

function buildDrawtextFilters(
  textClips: TextClip[],
  inputLabel: string,
  outputLabel: string,
): string[] {
  if (textClips.length === 0) return [];

  const filters: string[] = [];
  for (let i = 0; i < textClips.length; i++) {
    const tc = textClips[i];
    const inLabel = i === 0 ? inputLabel : `text_${i - 1}`;
    const outLabel = i === textClips.length - 1 ? outputLabel : `text_${i}`;

    const fontPath = resolveFontPath(tc.style.fontFamily, tc.style.bold, tc.style.italic);
    const escapedText = escapeDrawtext(tc.content);
    const hexColor = `0x${tc.style.color.replace('#', '')}`;
    const enableStart = tc.timelineStart.toFixed(3);
    const enableEnd = (tc.timelineStart + tc.duration).toFixed(3);

    const filter = [
      `[${inLabel}]drawtext=`,
      `fontfile='${fontPath}'`,
      `:text='${escapedText}'`,
      `:fontsize=${tc.style.fontSize}`,
      `:fontcolor=${hexColor}`,
      `:x=min(max(0\\,w*${tc.position.x}/100-tw/2)\\,w-tw)`,
      `:y=min(max(0\\,h*${tc.position.y}/100-th/2)\\,h-th)`,
      `:enable='between(t\\,${enableStart}\\,${enableEnd})'`,
      `[${outLabel}]`,
    ].join('');

    filters.push(filter);
  }

  return filters;
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

    const sortedVideo = [...videoTrackClips].sort(
      (a, b) => a.clip.timelineStart - b.clip.timelineStart,
    );
    const sortedAudio = [...audioTrackClips].sort(
      (a, b) => a.clip.timelineStart - b.clip.timelineStart,
    );

    // Collect text clips from text tracks
    const textClips = collectTextClips(config);

    if (sortedVideo.length === 0 && sortedAudio.length === 0 && textClips.length === 0) {
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

    if (inputIndex === 0 && textClips.length === 0) {
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
        const clipVol = input.clip.volume ?? 1;
        let aLabel: string;
        if (input.hasAudio) {
          const volLabel = `va${i}`;
          const { prevVol, nextVol } = findAdjacentVolumes(sortedVideo, i);
          const volExpr = buildVolumeExpression(
            clipVol,
            input.clip.fadeIn ?? 0,
            input.clip.fadeOut ?? 0,
            clipDuration,
            prevVol,
            nextVol,
          );
          let audioFilter = `[${idx}:a:0]aresample=48000`;
          if (volExpr) {
            audioFilter += `,${volExpr}`;
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

      const concatVideoLabel = textClips.length > 0 ? 'outv_pre_text' : 'outv';
      filterParts.push(
        `${concatVideoInputs.join('')}concat=n=${concatSegmentCount}:v=1:a=1[${concatVideoLabel}][video_audio]`,
      );

      // Chain drawtext filters for text overlays
      if (textClips.length > 0) {
        const drawtextFilters = buildDrawtextFilters(textClips, 'outv_pre_text', 'outv');
        filterParts.push(...drawtextFilters);
      }
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

        const { prevVol, nextVol } = findAdjacentVolumes(sortedAudio, i);
        const volExpr = buildVolumeExpression(
          clipVolume,
          input.clip.fadeIn ?? 0,
          input.clip.fadeOut ?? 0,
          clipDuration,
          prevVol,
          nextVol,
        );
        let audioFilter = `[${idx}:a:0]aresample=48000`;
        if (volExpr) {
          audioFilter += `,${volExpr}`;
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
          `${audioMixInputs.join('')}amix=inputs=${audioMixInputs.length}:duration=longest:dropout_transition=0:normalize=0[audio_track]`,
        );
      }
    }

    // Final mix: combine video audio and audio track
    if (hasVideoTrack && hasAudioTrack) {
      filterParts.push(
        `[video_audio][audio_track]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[outa]`,
      );
      args.push('-filter_complex', filterParts.join(';'));
      args.push('-map', '[outv]', '-map', '[outa]');
    } else if (hasVideoTrack) {
      // Rename video_audio to outa
      filterParts.push(`[video_audio]acopy[outa]`);
      args.push('-filter_complex', filterParts.join(';'));
      args.push('-map', '[outv]', '-map', '[outa]');
    } else if (hasAudioTrack) {
      // Audio only (possibly with text) — generate black video
      const totalAudioDuration = sortedAudio.reduce((max, input) => {
        const end = input.clip.timelineStart + (input.clip.outPoint - input.clip.inPoint);
        return Math.max(max, end);
      }, 0);
      const blackLabel = textClips.length > 0 ? 'outv_pre_text' : 'outv';
      filterParts.push(
        `color=c=black:s=${width}x${height}:r=${fps}:d=${totalAudioDuration},format=yuv420p[${blackLabel}]`,
      );
      if (textClips.length > 0) {
        filterParts.push(...buildDrawtextFilters(textClips, 'outv_pre_text', 'outv'));
      }
      args.push('-filter_complex', filterParts.join(';'));
      args.push('-map', '[outv]', '-map', '[audio_track]');
    } else if (textClips.length > 0) {
      // Text only — generate black video with silent audio
      const totalTextDuration = textClips.reduce((max, tc) => {
        return Math.max(max, tc.timelineStart + tc.duration);
      }, 0);
      filterParts.push(
        `color=c=black:s=${width}x${height}:r=${fps}:d=${totalTextDuration},format=yuv420p[outv_pre_text]`,
      );
      filterParts.push(...buildDrawtextFilters(textClips, 'outv_pre_text', 'outv'));
      filterParts.push(`anullsrc=channel_layout=stereo:sample_rate=48000[silence_raw]`);
      filterParts.push(`[silence_raw]atrim=0:${totalTextDuration}[outa]`);
      args.push('-filter_complex', filterParts.join(';'));
      args.push('-map', '[outv]', '-map', '[outa]');
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
      textClips.reduce((max, tc) => Math.max(max, tc.timelineStart + tc.duration), 0),
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
