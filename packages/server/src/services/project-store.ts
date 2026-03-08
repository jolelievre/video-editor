import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { projectConfigSchema, DATA_DIR } from '@video-editor/shared';
import type { ProjectConfig } from '@video-editor/shared';

async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

function projectDir(id: string): string {
  return join(DATA_DIR, id);
}

function configPath(id: string): string {
  return join(projectDir(id), 'config.json');
}

export async function listProjects(): Promise<
  Array<{ id: string; name: string; updatedAt: string }>
> {
  await ensureDataDir();
  const entries = await readdir(DATA_DIR, { withFileTypes: true });
  const projects: Array<{ id: string; name: string; updatedAt: string }> = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const config = await getProject(entry.name);
      projects.push({ id: config.id, name: config.name, updatedAt: config.updatedAt });
    } catch {
      // skip invalid project dirs
    }
  }

  return projects;
}

export async function getProject(id: string): Promise<ProjectConfig> {
  const raw = await readFile(configPath(id), 'utf-8');
  const data = JSON.parse(raw);
  return projectConfigSchema.parse(data);
}

export async function createProject(name: string): Promise<ProjectConfig> {
  await ensureDataDir();
  const id = uuidv4();
  const now = new Date().toISOString();

  const config: ProjectConfig = {
    version: '1.0',
    id,
    name,
    createdAt: now,
    updatedAt: now,
    resolution: { width: 1920, height: 1080 },
    fps: 30,
    sources: [],
    timeline: { tracks: [] },
  };

  await mkdir(join(projectDir(id), 'media'), { recursive: true });
  await writeFile(configPath(id), JSON.stringify(config, null, 2));

  return config;
}

export async function saveProject(config: ProjectConfig): Promise<ProjectConfig> {
  const validated = projectConfigSchema.parse({
    ...config,
    updatedAt: new Date().toISOString(),
  });
  await writeFile(configPath(validated.id), JSON.stringify(validated, null, 2));
  return validated;
}

export async function deleteProject(id: string): Promise<void> {
  const dir = projectDir(id);
  if (!existsSync(dir)) {
    throw new Error(`Project ${id} not found`);
  }
  await rm(dir, { recursive: true, force: true });
}
