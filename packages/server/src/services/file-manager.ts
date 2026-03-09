import { writeFile, unlink, mkdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import ffmpeg from 'fluent-ffmpeg';
import { DATA_DIR } from '@video-editor/shared';
import type { SourceFile } from '@video-editor/shared';
import { generateThumbnails } from './ffmpeg.js';

const THUMBNAIL_COUNT = 6;

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff']);
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.aac', '.ogg', '.flac', '.m4a', '.wma']);

export function detectMediaType(filename: string): 'video' | 'image' | 'audio' {
  const ext = extname(filename).toLowerCase();
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (AUDIO_EXTENSIONS.has(ext)) return 'audio';
  return 'video';
}

function mediaDir(projectId: string): string {
  return join(DATA_DIR, projectId, 'media');
}

interface ProbeResult {
  duration: number;
  width: number;
  height: number;
  fps: number;
}

export function probeFile(
  filePath: string,
  mediaType: 'video' | 'image' | 'audio',
): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);

      if (mediaType === 'audio') {
        resolve({
          duration: metadata.format.duration ?? 0,
          width: 0,
          height: 0,
          fps: 0,
        });
        return;
      }

      const videoStream = metadata.streams.find((s) => s.codec_type === 'video');
      if (!videoStream) return reject(new Error('No video stream found'));

      if (mediaType === 'image') {
        resolve({
          duration: 0,
          width: videoStream.width ?? 0,
          height: videoStream.height ?? 0,
          fps: 0,
        });
        return;
      }

      // video
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

  const mediaType = detectMediaType(filename);
  const probe = await probeFile(filePath, mediaType);

  // Generate thumbnails (skip for audio)
  if (mediaType !== 'audio') {
    const thumbDir = join(DATA_DIR, projectId, 'thumbs', id);
    const thumbCount = mediaType === 'image' ? 1 : THUMBNAIL_COUNT;
    mkdir(thumbDir, { recursive: true })
      .then(() => generateThumbnails(filePath, thumbDir, thumbCount, probe.duration))
      .catch(() => {
        // Thumbnails are non-critical; silently ignore errors
      });
  }

  return {
    id,
    filename,
    path: `media/${storedFilename}`,
    type: mediaType,
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
