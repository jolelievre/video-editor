import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve the monorepo root: shared lives at <root>/packages/shared/src/config.ts
const MONOREPO_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');

export const DATA_DIR =
  process.env.VIDEO_EDITOR_DATA_DIR ?? join(MONOREPO_ROOT, 'data', 'projects');
