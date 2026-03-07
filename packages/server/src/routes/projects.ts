import type { FastifyPluginAsync } from 'fastify';
import { projectConfigSchema } from '@video-editor/shared';
import {
  listProjects,
  getProject,
  createProject,
  saveProject,
  deleteProject,
} from '../services/project-store.js';

export const projectRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async () => {
    return listProjects();
  });

  app.post<{ Body: { name: string } }>('/', async (request, reply) => {
    const { name } = request.body;
    if (!name || typeof name !== 'string') {
      return reply.status(400).send({ error: 'name is required' });
    }
    const project = await createProject(name);
    return reply.status(201).send(project);
  });

  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    try {
      const project = await getProject(request.params.id);
      return project;
    } catch {
      return reply.status(404).send({ error: 'Project not found' });
    }
  });

  app.put<{ Params: { id: string } }>('/:id', async (request, reply) => {
    try {
      const config = projectConfigSchema.parse(request.body);
      if (config.id !== request.params.id) {
        return reply.status(400).send({ error: 'ID mismatch' });
      }
      const saved = await saveProject(config);
      return saved;
    } catch (err) {
      return reply.status(400).send({ error: 'Invalid project config', details: String(err) });
    }
  });

  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    try {
      await deleteProject(request.params.id);
      return reply.status(204).send();
    } catch {
      return reply.status(404).send({ error: 'Project not found' });
    }
  });
};
