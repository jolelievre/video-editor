import ffmpeg from 'fluent-ffmpeg';
import { join } from 'node:path';
import type { ProjectConfig } from '@video-editor/shared';

const DATA_DIR = join(process.cwd(), 'data', 'projects');

interface ExportProgress {
  percent: number;
  status: 'pending' | 'processing' | 'done' | 'error';
  error?: string;
}

const exportJobs = new Map<string, ExportProgress>();

export function getExportStatus(projectId: string): ExportProgress {
  return exportJobs.get(projectId) ?? { percent: 0, status: 'pending' };
}

export function getExportPath(projectId: string): string {
  return join(DATA_DIR, projectId, 'export.mp4');
}

export async function startExport(config: ProjectConfig): Promise<void> {
  const projectDir = join(DATA_DIR, config.id);
  const outputPath = getExportPath(config.id);

  exportJobs.set(config.id, { percent: 0, status: 'processing' });

  const allClips = config.timeline.tracks.flatMap((track) => track.clips);
  const sorted = [...allClips].sort((a, b) => a.timelineStart - b.timelineStart);

  if (sorted.length === 0) {
    exportJobs.set(config.id, { percent: 0, status: 'error', error: 'No clips on timeline' });
    return;
  }

  try {
    const command = ffmpeg();

    for (const clip of sorted) {
      const source = config.sources.find((s) => s.id === clip.sourceId);
      if (!source) continue;

      const inputPath = join(projectDir, source.path);
      command.input(inputPath).inputOptions([`-ss ${clip.inPoint}`, `-to ${clip.outPoint}`]);
    }

    const filterInputs = sorted.map((_, i) => `[${i}:v:0][${i}:a:0]`).join('');
    const filterComplex = `${filterInputs}concat=n=${sorted.length}:v=1:a=1[outv][outa]`;

    await new Promise<void>((resolve, reject) => {
      command
        .complexFilter(filterComplex)
        .outputOptions(['-map [outv]', '-map [outa]'])
        .output(outputPath)
        .on('progress', (progress) => {
          exportJobs.set(config.id, {
            percent: Math.round(progress.percent ?? 0),
            status: 'processing',
          });
        })
        .on('end', () => {
          exportJobs.set(config.id, { percent: 100, status: 'done' });
          resolve();
        })
        .on('error', (err) => {
          exportJobs.set(config.id, { percent: 0, status: 'error', error: err.message });
          reject(err);
        })
        .run();
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    exportJobs.set(config.id, { percent: 0, status: 'error', error: message });
  }
}
