import ffmpeg from 'fluent-ffmpeg';
import { join } from 'node:path';
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

export async function startExport(
  config: ProjectConfig,
  callbacks?: ExportCallbacks,
): Promise<void> {
  const projectDir = join(DATA_DIR, config.id);
  const outputPath = getExportPath(config.id);

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
    // Resolve input paths and check for audio streams
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

    const allHaveAudio = inputs.every((i) => i.hasAudio);
    const command = ffmpeg();

    for (const input of inputs) {
      command
        .input(input.path)
        .inputOptions([`-ss ${input.clip.inPoint}`, `-to ${input.clip.outPoint}`]);
    }

    const streamLabels = inputs
      .map((_, i) => (allHaveAudio ? `[${i}:v:0][${i}:a:0]` : `[${i}:v:0]`))
      .join('');
    const audioFlag = allHaveAudio ? 1 : 0;
    const outputLabels = allHaveAudio ? '[outv][outa]' : '[outv]';
    const filterComplex = `${streamLabels}concat=n=${inputs.length}:v=1:a=${audioFlag}${outputLabels}`;

    const outputOptions = allHaveAudio
      ? ['-map [outv]', '-map [outa]']
      : ['-map [outv]'];

    // Compute expected total output duration from clip trim ranges
    const totalDuration = inputs.reduce((sum, i) => sum + (i.clip.outPoint - i.clip.inPoint), 0);

    await new Promise<void>((resolve, reject) => {
      command
        .complexFilter(filterComplex)
        .outputOptions(outputOptions)
        .output(outputPath)
        .on('progress', (progress) => {
          if (totalDuration <= 0 || !progress.timemark) return;
          const parts = progress.timemark.split(':').map(Number);
          if (parts.some((p) => isNaN(p))) return;
          const currentSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
          const percent = Math.min(99, Math.round((currentSeconds / totalDuration) * 100));
          exportJobs.set(config.id, { percent, status: 'processing' });
          callbacks?.onProgress?.(percent);
        })
        .on('end', () => {
          exportJobs.set(config.id, { percent: 100, status: 'done' });
          callbacks?.onDone?.();
          resolve();
        })
        .on('error', (err) => {
          exportJobs.set(config.id, { percent: 0, status: 'error', error: err.message });
          callbacks?.onError?.(err.message);
          reject(err);
        })
        .run();
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    exportJobs.set(config.id, { percent: 0, status: 'error', error: message });
    callbacks?.onError?.(message);
  }
}
