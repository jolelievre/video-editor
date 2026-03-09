export type {
  ProjectConfig,
  SourceFile,
  Track,
  Clip,
  TextStyle,
  TextClip,
  TextAnimation,
  TextAnimationType,
  SlideDirection,
  TypewriterAlignment,
} from './types.js';
export {
  projectConfigSchema,
  sourceFileSchema,
  trackSchema,
  clipSchema,
  textStyleSchema,
  textClipSchema,
  textAnimationSchema,
} from './schema.js';
export type { ProjectConfigSchema, SourceFileSchema, TrackSchema, ClipSchema } from './schema.js';
export { DATA_DIR } from './config.js';
export { BUNDLED_FONTS } from './fonts.js';
export type { BundledFont } from './fonts.js';
