import { defineConfig } from 'vitest/config';
import { join } from 'node:path';

export default defineConfig({
  test: {
    env: {
      VIDEO_EDITOR_DATA_DIR: join(process.cwd(), 'data', 'test-projects'),
    },
  },
});
