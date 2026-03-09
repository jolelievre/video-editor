export interface ProjectConfig {
  version: '1.0';
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  resolution: { width: number; height: number };
  fps: number;
  sources: SourceFile[];
  timeline: { tracks: Track[] };
}

export interface SourceFile {
  id: string;
  filename: string;
  path: string;
  type: 'video' | 'image' | 'audio';
  duration: number;    // 0 for images
  width: number;       // 0 for audio
  height: number;      // 0 for audio
  fps: number;         // 0 for images/audio
}

export interface Track {
  id: string;
  name: string;
  type: 'video' | 'audio';
  clips: Clip[];
}

export interface Clip {
  id: string;
  sourceId: string;
  inPoint: number;
  outPoint: number;
  timelineStart: number;
  volume: number;       // 0.0-2.0, default 1.0
  fadeIn: number;        // seconds, default 0
  fadeOut: number;       // seconds, default 0
}
