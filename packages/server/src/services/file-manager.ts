import { writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import ffmpeg from 'fluent-ffmpeg';
import { DATA_DIR } from '@video-editor/shared';
import type { SourceFile } from '@video-editor/shared';

function mediaDir(projectId: string): string {
  return join(DATA_DIR, projectId, 'media');
}

interface ProbeResult {
  duration: number;
  width: number;
  height: number;
  fps: number;
}

export function probeFile(filePath: string): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);

      const videoStream = metadata.streams.find((s) => s.codec_type === 'video');
      if (!videoStream) return reject(new Error('No video stream found'));

      let fps = 30;
      if (videoStream.r_frame_rate) {
        const parts = videoStream.r_frame_rate.split('/');
        fps = parts.length === 2 ? Number(parts[0]) / Number(parts[1]) : Number(parts[0]);
      }

      resolve({
        duration: metadata.format.duration ?? 0,
        width: videoStream.width ?? 0,
        height: videoStream.height ?? 0,
        fps: Math.round(fps * 100) / 100,
      });
    });
  });
}

export async function saveUpload(
  projectId: string,
  filename: string,
  buffer: Buffer,
): Promise<SourceFile> {
  const id = uuidv4();
  const ext = filename.substring(filename.lastIndexOf('.'));
  const storedFilename = `${id}${ext}`;
  const filePath = join(mediaDir(projectId), storedFilename);

  await writeFile(filePath, buffer);

  const probe = await probeFile(filePath);

  return {
    id,
    filename,
    path: `media/${storedFilename}`,
    duration: probe.duration,
    width: probe.width,
    height: probe.height,
    fps: probe.fps,
  };
}

export async function deleteFile(projectId: string, relativePath: string): Promise<void> {
  const filePath = join(DATA_DIR, projectId, relativePath);
  await unlink(filePath);
}
