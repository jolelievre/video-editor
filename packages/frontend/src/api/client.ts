import type { ProjectConfig, SourceFile } from '@video-editor/shared';

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  if (options?.body) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${BASE}${path}`, {
    headers,
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function listProjects(): Promise<Array<{ id: string; name: string; updatedAt: string }>> {
  return request('/projects');
}

export function createProject(name: string): Promise<ProjectConfig> {
  return request('/projects', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function getProject(id: string): Promise<ProjectConfig> {
  return request(`/projects/${id}`);
}

export function saveProject(config: ProjectConfig): Promise<ProjectConfig> {
  return request(`/projects/${config.id}`, {
    method: 'PUT',
    body: JSON.stringify(config),
  });
}

export function deleteProject(id: string): Promise<void> {
  return request(`/projects/${id}`, { method: 'DELETE' });
}

export async function uploadSource(projectId: string, file: File): Promise<SourceFile> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${BASE}/projects/${projectId}/sources`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
  return res.json();
}

export function deleteSource(projectId: string, sourceId: string): Promise<void> {
  return request(`/projects/${projectId}/sources/${sourceId}`, { method: 'DELETE' });
}

export function getStreamUrl(projectId: string, sourceId: string): string {
  return `${BASE}/projects/${projectId}/sources/${sourceId}/stream`;
}

export function getThumbnailUrl(projectId: string, sourceId: string, index: number): string {
  return `${BASE}/projects/${projectId}/sources/${sourceId}/thumb/${index}`;
}

export async function startExport(projectId: string): Promise<{ status: string }> {
  const res = await fetch(`${BASE}/projects/${projectId}/export`, { method: 'POST' });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

export function getExportStatus(
  projectId: string,
): Promise<{ percent: number; status: string; error?: string }> {
  return request(`/projects/${projectId}/export/status`);
}

export function getExportDownloadUrl(projectId: string): string {
  return `${BASE}/projects/${projectId}/export/download`;
}
