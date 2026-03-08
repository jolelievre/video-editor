import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { rm } from 'node:fs/promises';
import { buildApp } from '../app.js';
import { DATA_DIR } from '@video-editor/shared';

describe('Project routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
    await rm(DATA_DIR, { recursive: true, force: true });
  });

  it('GET /api/projects returns empty list initially', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/projects' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('POST /api/projects creates a new project', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { name: 'Test Project' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.name).toBe('Test Project');
    expect(body.version).toBe('1.0');
    expect(body.id).toBeDefined();
  });

  it('GET /api/projects/:id returns the project', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { name: 'Get Test' },
    });
    const { id } = createRes.json();

    const res = await app.inject({ method: 'GET', url: `/api/projects/${id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe('Get Test');
  });

  it('PUT /api/projects/:id updates the project', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { name: 'Update Test' },
    });
    const config = createRes.json();

    config.name = 'Updated Name';
    const res = await app.inject({
      method: 'PUT',
      url: `/api/projects/${config.id}`,
      payload: config,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe('Updated Name');
  });

  it('DELETE /api/projects/:id removes the project', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { name: 'Delete Test' },
    });
    const { id } = createRes.json();

    const res = await app.inject({ method: 'DELETE', url: `/api/projects/${id}` });
    expect(res.statusCode).toBe(204);

    const getRes = await app.inject({ method: 'GET', url: `/api/projects/${id}` });
    expect(getRes.statusCode).toBe(404);
  });

  it('GET /api/projects/:id returns 404 for non-existent', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/projects/nonexistent' });
    expect(res.statusCode).toBe(404);
  });

  it('POST /api/projects rejects missing name', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});
