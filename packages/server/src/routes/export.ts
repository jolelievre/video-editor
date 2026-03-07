import { existsSync } from 'node:fs';
import { createReadStream } from 'node:fs';
import type { FastifyPluginAsync } from 'fastify';
import { getProject } from '../services/project-store.js';
import { startExport, getExportStatus, getExportPath } from '../services/ffmpeg.js';

export const exportRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Params: { id: string } }>('/:id/export', async (request, reply) => {
    try {
      const config = await getProject(request.params.id);
      // Start export in background (don't await)
      startExport(config);
      return reply.status(202).send({ status: 'processing' });
    } catch {
      return reply.status(404).send({ error: 'Project not found' });
    }
  });

  app.get<{ Params: { id: string } }>('/:id/export/status', async (request) => {
    return getExportStatus(request.params.id);
  });

  app.get<{ Params: { id: string } }>('/:id/export/download', async (request, reply) => {
    const exportPath = getExportPath(request.params.id);
    if (!existsSync(exportPath)) {
      return reply.status(404).send({ error: 'Export not found' });
    }

    return reply
      .headers({
        'Content-Type': 'video/mp4',
        'Content-Disposition': 'attachment; filename="export.mp4"',
      })
      .send(createReadStream(exportPath));
  });
};
