import { join } from 'node:path';
import { createReadStream, existsSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { BUNDLED_FONTS } from '@video-editor/shared';
import { getFontsDir } from '../services/font-resolver.js';

export async function fontRoutes(app: FastifyInstance) {
  app.get('/api/fonts', async () => {
    return BUNDLED_FONTS;
  });

  app.get<{ Params: { filename: string } }>('/api/fonts/:filename', async (req, reply) => {
    const { filename } = req.params;

    // Prevent path traversal
    if (filename.includes('..') || filename.includes('/')) {
      return reply.status(400).send({ error: 'Invalid filename' });
    }

    const filePath = join(getFontsDir(), filename);
    if (!existsSync(filePath)) {
      return reply.status(404).send({ error: 'Font not found' });
    }

    reply.header('Content-Type', 'font/ttf');
    reply.header('Cache-Control', 'public, max-age=31536000, immutable');
    return reply.send(createReadStream(filePath));
  });
}
