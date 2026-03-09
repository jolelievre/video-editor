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
  duration: number; // 0 for images
  width: number; // 0 for audio
  height: number; // 0 for audio
  fps: number; // 0 for images/audio
}

export interface Track {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'text';
  clips: Clip[];
  textClips: TextClip[];
}

export interface Clip {
  id: string;
  sourceId: string;
  inPoint: number;
  outPoint: number;
  timelineStart: number;
  volume: number; // 0.0-2.0, default 1.0
  fadeIn: number; // seconds, default 0
  fadeOut: number; // seconds, default 0
}

export interface TextStyle {
  fontFamily: string; // from bundled font set, e.g. "Roboto"
  fontSize: number; // pixels relative to output resolution
  color: string; // hex, e.g. "#FFFFFF"
  bold: boolean;
  italic: boolean;
}

export type TextAnimationType = 'none' | 'fade' | 'slide' | 'typewriter';
export type SlideDirection = 'left' | 'right' | 'top' | 'bottom';

export type TypewriterAlignment = 'center' | 'left';

export interface TextAnimation {
  type: TextAnimationType;
  duration: number; // seconds (0 = instant)
  direction?: SlideDirection; // only for slide type
  alignment?: TypewriterAlignment; // only for typewriter type, default 'center'
}

export interface TextClip {
  id: string;
  content: string; // single-line
  timelineStart: number; // seconds
  duration: number; // seconds
  style: TextStyle;
  position: {
    x: number; // 0-100, percentage of video width (center point)
    y: number; // 0-100, percentage of video height (center point)
  };
  animationIn?: TextAnimation;
  animationOut?: TextAnimation;
}
