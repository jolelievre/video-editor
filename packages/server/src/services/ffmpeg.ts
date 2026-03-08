import ffmpeg from 'fluent-ffmpeg';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { ProjectConfig } from '@video-editor/shared';
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

export function generateThumbnails(
  inputPath: string,
  outputDir: string,
  count: number,
  duration: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timestamps: string[] = [];
    for (let i = 0; i < count; i++) {
      const time = count === 1 ? 0 : (duration * i) / (count - 1);
      timestamps.push(time.toFixed(2));
    }

    ffmpeg(inputPath)
      .screenshots({
        timestamps,
        filename: 'thumb_%i.jpg',
        folder: outputDir,
        size: '192x?',
      })
      .on('end', () => resolve())
      .on('error', (err) => reject(err));
  });
}

function parseTimemark(timemark: string): number {
  const parts = timemark.split(':').map(Number);
  if (parts.some((p) => isNaN(p))) return -1;
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
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

  const allClips = config.timeline.tracks.flatMap((track) => track.clips);
  const sorted = [...allClips].sort((a, b) => a.timelineStart - b.timelineStart);

  if (sorted.length === 0) {
    const error = 'No clips on timeline';
    exportJobs.set(config.id, { percent: 0, status: 'error', error });
    callbacks?.onError?.(error);
    return;
  }

  try {
    const inputs: Array<{ path: string; clip: (typeof sorted)[0]; hasAudio: boolean }> = [];
    for (const clip of sorted) {
      const source = config.sources.find((s) => s.id === clip.sourceId);
      if (!source) continue;
      const inputPath = join(projectDir, source.path);
      const hasAudio = await probeHasAudio(inputPath);
      inputs.push({ path: inputPath, clip, hasAudio });
    }

    if (inputs.length === 0) {
      const error = 'No valid source files found';
      exportJobs.set(config.id, { percent: 0, status: 'error', error });
      callbacks?.onError?.(error);
      return;
    }

    const { width, height } = config.resolution;
    const fps = config.fps;

    const args: string[] = ['-hide_banner'];

    // Inputs with trim
    for (const input of inputs) {
      args.push('-ss', String(input.clip.inPoint));
      args.push('-to', String(input.clip.outPoint));
      args.push('-i', input.path);
    }

    // Build filter_complex: normalize each input, then concat
    const filterParts: string[] = [];
    const concatInputs: string[] = [];

    for (let i = 0; i < inputs.length; i++) {
      const vLabel = `v${i}`;
      filterParts.push(
        `[${i}:v:0]scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
          `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,` +
          `setsar=1,fps=${fps},format=yuv420p[${vLabel}]`,
      );

      let aLabel: string;
      if (inputs[i].hasAudio) {
        aLabel = `a${i}`;
        filterParts.push(`[${i}:a:0]aresample=48000[${aLabel}]`);
      } else {
        aLabel = `sa${i}`;
        const clipDuration = inputs[i].clip.outPoint - inputs[i].clip.inPoint;
        filterParts.push(
          `anullsrc=channel_layout=stereo:sample_rate=48000[${aLabel}_raw]`,
        );
        filterParts.push(
          `[${aLabel}_raw]atrim=0:${clipDuration}[${aLabel}]`,
        );
      }

      concatInputs.push(`[${vLabel}][${aLabel}]`);
    }

    filterParts.push(
      `${concatInputs.join('')}concat=n=${inputs.length}:v=1:a=1[outv][outa]`,
    );

    args.push('-filter_complex', filterParts.join(';'));
    args.push('-map', '[outv]', '-map', '[outa]');
    args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '23');
    args.push('-c:a', 'aac', '-b:a', '192k');
    args.push('-movflags', '+faststart');
    args.push('-y', outputPath);

    const totalDuration = inputs.reduce((sum, i) => sum + (i.clip.outPoint - i.clip.inPoint), 0);

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
