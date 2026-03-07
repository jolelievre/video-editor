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
  duration: number;
  width: number;
  height: number;
  fps: number;
}

export interface Track {
  id: string;
  name: string;
  clips: Clip[];
}

export interface Clip {
  id: string;
  sourceId: string;
  inPoint: number;
  outPoint: number;
  timelineStart: number;
}
