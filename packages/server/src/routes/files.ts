import { createReadStream, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { FastifyPluginAsync } from 'fastify';
import { getProject, saveProject } from '../services/project-store.js';
import { saveUpload, deleteFile } from '../services/file-manager.js';

const DATA_DIR = join(process.cwd(), 'data', 'projects');

export const fileRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Params: { id: string } }>('/:id/sources', async (request, reply) => {
    const file = await request.file();
    if (!file) {
      return reply.status(400).send({ error: 'No file uploaded' });
    }

    const buffer = await file.toBuffer();
    const source = await saveUpload(request.params.id, file.filename, buffer);

    const config = await getProject(request.params.id);
    config.sources.push(source);
    await saveProject(config);

    return reply.status(201).send(source);
  });

  app.delete<{ Params: { id: string; sourceId: string } }>(
    '/:id/sources/:sourceId',
    async (request, reply) => {
      const config = await getProject(request.params.id);
      const source = config.sources.find((s) => s.id === request.params.sourceId);
      if (!source) {
        return reply.status(404).send({ error: 'Source not found' });
      }

      await deleteFile(request.params.id, source.path);
      config.sources = config.sources.filter((s) => s.id !== request.params.sourceId);

      // Remove clips referencing this source
      for (const track of config.timeline.tracks) {
        track.clips = track.clips.filter((c) => c.sourceId !== request.params.sourceId);
      }

      await saveProject(config);
      return reply.status(204).send();
    },
  );

  app.get<{ Params: { id: string; sourceId: string } }>(
    '/:id/sources/:sourceId/stream',
    async (request, reply) => {
      const config = await getProject(request.params.id);
      const source = config.sources.find((s) => s.id === request.params.sourceId);
      if (!source) {
        return reply.status(404).send({ error: 'Source not found' });
      }

      const filePath = join(DATA_DIR, request.params.id, source.path);
      if (!existsSync(filePath)) {
        return reply.status(404).send({ error: 'File not found' });
      }

      const stat = statSync(filePath);
      const range = request.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        const chunkSize = end - start + 1;

        return reply
          .status(206)
          .headers({
            'Content-Range': `bytes ${start}-${end}/${stat.size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': 'video/mp4',
          })
          .send(createReadStream(filePath, { start, end }));
      }

      return reply
        .headers({
          'Content-Length': stat.size,
          'Content-Type': 'video/mp4',
          'Accept-Ranges': 'bytes',
        })
        .send(createReadStream(filePath));
    },
  );
};
