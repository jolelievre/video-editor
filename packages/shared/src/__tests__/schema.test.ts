import { describe, it, expect } from 'vitest';
import { projectConfigSchema, clipSchema, trackSchema, sourceFileSchema } from '../schema.js';

const validConfig = {
  version: '1.0' as const,
  id: 'project-1',
  name: 'Test Project',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  resolution: { width: 1920, height: 1080 },
  fps: 30,
  sources: [
    {
      id: 'source-1',
      filename: 'video.mp4',
      path: 'media/video.mp4',
      duration: 60,
      width: 1920,
      height: 1080,
      fps: 30,
    },
  ],
  timeline: {
    tracks: [
      {
        id: 'track-1',
        name: 'Track 1',
        clips: [
          {
            id: 'clip-1',
            sourceId: 'source-1',
            inPoint: 0,
            outPoint: 30,
            timelineStart: 0,
          },
        ],
      },
    ],
  },
};

describe('projectConfigSchema', () => {
  it('accepts a valid config', () => {
    const result = projectConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });

  it('accepts config with empty sources and tracks', () => {
    const result = projectConfigSchema.safeParse({
      ...validConfig,
      sources: [],
      timeline: { tracks: [] },
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid version', () => {
    const result = projectConfigSchema.safeParse({ ...validConfig, version: '2.0' });
    expect(result.success).toBe(false);
  });

  it('rejects missing name', () => {
    const { name: _, ...noName } = validConfig;
    const result = projectConfigSchema.safeParse(noName);
    expect(result.success).toBe(false);
  });

  it('rejects negative resolution', () => {
    const result = projectConfigSchema.safeParse({
      ...validConfig,
      resolution: { width: -1, height: 1080 },
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid datetime', () => {
    const result = projectConfigSchema.safeParse({
      ...validConfig,
      createdAt: 'not-a-date',
    });
    expect(result.success).toBe(false);
  });
});

describe('clipSchema', () => {
  it('accepts valid clip', () => {
    const result = clipSchema.safeParse({
      id: 'clip-1',
      sourceId: 'source-1',
      inPoint: 0,
      outPoint: 10,
      timelineStart: 0,
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative inPoint', () => {
    const result = clipSchema.safeParse({
      id: 'clip-1',
      sourceId: 'source-1',
      inPoint: -1,
      outPoint: 10,
      timelineStart: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe('trackSchema', () => {
  it('accepts valid track with empty clips', () => {
    const result = trackSchema.safeParse({
      id: 'track-1',
      name: 'Track 1',
      clips: [],
    });
    expect(result.success).toBe(true);
  });
});

describe('sourceFileSchema', () => {
  it('rejects zero duration', () => {
    const result = sourceFileSchema.safeParse({
      id: 'source-1',
      filename: 'video.mp4',
      path: 'media/video.mp4',
      duration: 0,
      width: 1920,
      height: 1080,
      fps: 30,
    });
    expect(result.success).toBe(false);
  });
});
