import { describe, it, expect } from 'vitest';
import {
  projectConfigSchema,
  clipSchema,
  trackSchema,
  sourceFileSchema,
  textClipSchema,
  textStyleSchema,
  textAnimationSchema,
} from '../schema.js';

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

  it('accepts config with text tracks', () => {
    const result = projectConfigSchema.safeParse({
      ...validConfig,
      timeline: {
        tracks: [
          ...validConfig.timeline.tracks,
          {
            id: 'text-track-1',
            name: 'Text 1',
            type: 'text',
            clips: [],
            textClips: [
              {
                id: 'tc-1',
                content: 'Hello World',
                timelineStart: 0,
                duration: 5,
                style: {
                  fontFamily: 'Roboto',
                  fontSize: 48,
                  color: '#FFFFFF',
                  bold: false,
                  italic: false,
                },
                position: { x: 50, y: 50 },
              },
            ],
          },
        ],
      },
    });
    expect(result.success).toBe(true);
  });

  it('backward compatible: existing configs without textClips still validate', () => {
    // The default([]) on textClips means old configs without it are valid
    const result = projectConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.timeline.tracks[0].textClips).toEqual([]);
    }
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

  it('accepts text track type', () => {
    const result = trackSchema.safeParse({
      id: 'track-1',
      name: 'Text 1',
      type: 'text',
      clips: [],
      textClips: [],
    });
    expect(result.success).toBe(true);
  });

  it('defaults textClips to empty array', () => {
    const result = trackSchema.safeParse({
      id: 'track-1',
      name: 'Track 1',
      clips: [],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.textClips).toEqual([]);
    }
  });
});

describe('textStyleSchema', () => {
  it('applies default values', () => {
    const result = textStyleSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fontFamily).toBe('Roboto');
      expect(result.data.fontSize).toBe(48);
      expect(result.data.color).toBe('#FFFFFF');
      expect(result.data.bold).toBe(false);
      expect(result.data.italic).toBe(false);
    }
  });

  it('rejects invalid color format', () => {
    const result = textStyleSchema.safeParse({ color: 'red' });
    expect(result.success).toBe(false);
  });

  it('rejects fontSize below 8', () => {
    const result = textStyleSchema.safeParse({ fontSize: 5 });
    expect(result.success).toBe(false);
  });

  it('rejects fontSize above 500', () => {
    const result = textStyleSchema.safeParse({ fontSize: 501 });
    expect(result.success).toBe(false);
  });
});

describe('textClipSchema', () => {
  it('accepts a valid text clip', () => {
    const result = textClipSchema.safeParse({
      id: 'tc-1',
      content: 'Hello World',
      timelineStart: 2,
      duration: 5,
      style: {
        fontFamily: 'Roboto',
        fontSize: 48,
        color: '#FFFFFF',
        bold: false,
        italic: false,
      },
      position: { x: 50, y: 50 },
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty content', () => {
    const result = textClipSchema.safeParse({
      id: 'tc-1',
      content: '',
      timelineStart: 0,
      duration: 5,
      style: {},
      position: {},
    });
    expect(result.success).toBe(false);
  });

  it('rejects duration below 0.1', () => {
    const result = textClipSchema.safeParse({
      id: 'tc-1',
      content: 'Test',
      timelineStart: 0,
      duration: 0.05,
      style: {},
      position: {},
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative duration', () => {
    const result = textClipSchema.safeParse({
      id: 'tc-1',
      content: 'Test',
      timelineStart: 0,
      duration: -1,
      style: {},
      position: {},
    });
    expect(result.success).toBe(false);
  });

  it('rejects position x out of 0-100 range', () => {
    const result = textClipSchema.safeParse({
      id: 'tc-1',
      content: 'Test',
      timelineStart: 0,
      duration: 5,
      style: {},
      position: { x: 101, y: 50 },
    });
    expect(result.success).toBe(false);
  });

  it('rejects position y out of 0-100 range', () => {
    const result = textClipSchema.safeParse({
      id: 'tc-1',
      content: 'Test',
      timelineStart: 0,
      duration: 5,
      style: {},
      position: { x: 50, y: -5 },
    });
    expect(result.success).toBe(false);
  });

  it('applies default position values', () => {
    const result = textClipSchema.safeParse({
      id: 'tc-1',
      content: 'Test',
      timelineStart: 0,
      duration: 5,
      style: {},
      position: {},
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.position.x).toBe(50);
      expect(result.data.position.y).toBe(50);
    }
  });
});

describe('textAnimationSchema', () => {
  it('applies default values', () => {
    const result = textAnimationSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('none');
      expect(result.data.duration).toBe(0);
      expect(result.data.direction).toBeUndefined();
    }
  });

  it('accepts all animation types', () => {
    for (const type of ['none', 'fade', 'slide', 'typewriter'] as const) {
      const result = textAnimationSchema.safeParse({ type, duration: 1 });
      expect(result.success).toBe(true);
    }
  });

  it('accepts slide with direction', () => {
    for (const direction of ['left', 'right', 'top', 'bottom'] as const) {
      const result = textAnimationSchema.safeParse({ type: 'slide', duration: 1, direction });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.direction).toBe(direction);
      }
    }
  });

  it('rejects duration above 30', () => {
    const result = textAnimationSchema.safeParse({ type: 'fade', duration: 31 });
    expect(result.success).toBe(false);
  });

  it('rejects negative duration', () => {
    const result = textAnimationSchema.safeParse({ type: 'fade', duration: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects invalid type', () => {
    const result = textAnimationSchema.safeParse({ type: 'bounce', duration: 1 });
    expect(result.success).toBe(false);
  });

  it('rejects invalid direction', () => {
    const result = textAnimationSchema.safeParse({ type: 'slide', duration: 1, direction: 'up' });
    expect(result.success).toBe(false);
  });

  it('accepts typewriter with alignment', () => {
    for (const alignment of ['center', 'left'] as const) {
      const result = textAnimationSchema.safeParse({
        type: 'typewriter',
        duration: 2,
        alignment,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.alignment).toBe(alignment);
      }
    }
  });

  it('defaults alignment to undefined', () => {
    const result = textAnimationSchema.safeParse({ type: 'typewriter', duration: 1 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.alignment).toBeUndefined();
    }
  });

  it('rejects invalid alignment', () => {
    const result = textAnimationSchema.safeParse({
      type: 'typewriter',
      duration: 1,
      alignment: 'right',
    });
    expect(result.success).toBe(false);
  });
});

describe('textClipSchema animation fields', () => {
  const baseTextClip = {
    id: 'tc-1',
    content: 'Hello',
    timelineStart: 0,
    duration: 5,
    style: {},
    position: {},
  };

  it('defaults animationIn and animationOut', () => {
    const result = textClipSchema.safeParse(baseTextClip);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.animationIn).toEqual({ type: 'none', duration: 0 });
      expect(result.data.animationOut).toEqual({ type: 'none', duration: 0 });
    }
  });

  it('accepts explicit animation values', () => {
    const result = textClipSchema.safeParse({
      ...baseTextClip,
      animationIn: { type: 'fade', duration: 0.5 },
      animationOut: { type: 'slide', duration: 1, direction: 'right' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.animationIn.type).toBe('fade');
      expect(result.data.animationIn.duration).toBe(0.5);
      expect(result.data.animationOut.type).toBe('slide');
      expect(result.data.animationOut.direction).toBe('right');
    }
  });

  it('backward compatibility: text clips without animation fields parse correctly', () => {
    const result = textClipSchema.safeParse(baseTextClip);
    expect(result.success).toBe(true);
  });
});

describe('sourceFileSchema', () => {
  it('accepts zero duration for images', () => {
    const result = sourceFileSchema.safeParse({
      id: 'source-1',
      filename: 'photo.png',
      path: 'media/photo.png',
      type: 'image',
      duration: 0,
      width: 1920,
      height: 1080,
      fps: 0,
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative duration', () => {
    const result = sourceFileSchema.safeParse({
      id: 'source-1',
      filename: 'video.mp4',
      path: 'media/video.mp4',
      duration: -1,
      width: 1920,
      height: 1080,
      fps: 30,
    });
    expect(result.success).toBe(false);
  });

  it('accepts audio source with zero width/height', () => {
    const result = sourceFileSchema.safeParse({
      id: 'source-2',
      filename: 'music.mp3',
      path: 'media/music.mp3',
      type: 'audio',
      duration: 120,
      width: 0,
      height: 0,
      fps: 0,
    });
    expect(result.success).toBe(true);
  });

  it('defaults type to video when not provided', () => {
    const result = sourceFileSchema.safeParse({
      id: 'source-1',
      filename: 'video.mp4',
      path: 'media/video.mp4',
      duration: 60,
      width: 1920,
      height: 1080,
      fps: 30,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('video');
    }
  });
});
