import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { projectRoutes } from './routes/projects.js';
import { fileRoutes } from './routes/files.js';
import { exportRoutes } from './routes/export.js';
import { fontRoutes } from './routes/fonts.js';

export async function buildApp(opts = {}) {
  const app = Fastify(opts);

  await app.register(cors, { origin: true });
  await app.register(multipart, { limits: { fileSize: 500 * 1024 * 1024 } });

  await app.register(projectRoutes, { prefix: '/api/projects' });
  await app.register(fileRoutes, { prefix: '/api/projects' });
  await app.register(exportRoutes, { prefix: '/api/projects' });
  await app.register(fontRoutes);

  return app;
}
