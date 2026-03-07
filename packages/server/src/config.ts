import { join } from 'node:path';

export const DATA_DIR =
  process.env.VIDEO_EDITOR_DATA_DIR ?? join(process.cwd(), 'data', 'projects');
