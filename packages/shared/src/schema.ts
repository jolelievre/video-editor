import { z } from 'zod';

export const clipSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  inPoint: z.number().min(0),
  outPoint: z.number().min(0),
  timelineStart: z.number().min(0),
  volume: z.number().min(0).max(1.5).default(1),
  fadeIn: z.number().min(0).default(0),
  fadeOut: z.number().min(0).default(0),
});

export const textStyleSchema = z.object({
  fontFamily: z.string().min(1).default('Roboto'),
  fontSize: z.number().min(8).max(500).default(48),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default('#FFFFFF'),
  bold: z.boolean().default(false),
  italic: z.boolean().default(false),
});

export const textAnimationSchema = z.object({
  type: z.enum(['none', 'fade', 'slide', 'typewriter']).default('none'),
  duration: z.number().min(0).max(30).default(0),
  direction: z.enum(['left', 'right', 'top', 'bottom']).optional(),
  alignment: z.enum(['center', 'left']).optional(),
});

export const textClipSchema = z.object({
  id: z.string().min(1),
  content: z.string().min(1),
  timelineStart: z.number().min(0),
  duration: z.number().min(0.1),
  style: textStyleSchema,
  position: z.object({
    x: z.number().min(0).max(100).default(50),
    y: z.number().min(0).max(100).default(50),
  }),
  animationIn: textAnimationSchema.default({ type: 'none', duration: 0 }),
  animationOut: textAnimationSchema.default({ type: 'none', duration: 0 }),
});

export const trackSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['video', 'audio', 'text']).default('video'),
  clips: z.array(clipSchema),
  textClips: z.array(textClipSchema).default([]),
});

export const sourceFileSchema = z.object({
  id: z.string().min(1),
  filename: z.string().min(1),
  path: z.string().min(1),
  type: z.enum(['video', 'image', 'audio']).default('video'),
  duration: z.number().min(0),
  width: z.number().int().min(0),
  height: z.number().int().min(0),
  fps: z.number().min(0),
});

export const projectConfigSchema = z.object({
  version: z.literal('1.0'),
  id: z.string().min(1),
  name: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  resolution: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  fps: z.number().positive(),
  sources: z.array(sourceFileSchema),
  timeline: z.object({
    tracks: z.array(trackSchema),
  }),
});

export type ProjectConfigSchema = z.infer<typeof projectConfigSchema>;
export type SourceFileSchema = z.infer<typeof sourceFileSchema>;
export type TrackSchema = z.infer<typeof trackSchema>;
export type ClipSchema = z.infer<typeof clipSchema>;
