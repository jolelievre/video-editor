# Video Editor

A web-based video editor built with Vue 3 and Fastify. Upload video files, arrange clips on a timeline, preview the result in real time, and export the final cut as an MP4.

## Features

- **Project management** — Create, rename, and delete editing projects
- **File upload** — Upload video source files to a project
- **Timeline editing** — Drag and drop sources onto a multi-track timeline, reorder clips, trim in/out points, and zoom the timeline view
- **Video preview** — Real-time playback driven by the timeline playhead with play/pause, seeking, scrubbing, and volume control
- **Export** — Concatenate timeline clips into a single MP4 using FFmpeg, with progress tracking and download

## Tech Stack

| Layer    | Technology                               |
| -------- | ---------------------------------------- |
| Frontend | Vue 3, Vue Router, Pinia, Vite           |
| Backend  | Fastify 5, fluent-ffmpeg, TypeScript     |
| Shared   | Zod schemas for cross-package validation |
| Monorepo | npm workspaces                           |

## Prerequisites

- **Node.js** >= 18
- **npm** >= 9
- **FFmpeg** installed and available on `PATH` (required for video export)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

This installs dependencies for all workspaces (`packages/shared`, `packages/server`, `packages/frontend`).

### 2. Build the shared package

The shared package must be built first since both the server and frontend depend on it:

```bash
npm run build -w packages/shared
```

### 3. Start the development servers

Run both the backend and frontend in parallel:

```bash
npm run dev
```

This starts:

- **Backend** — Fastify server on `http://localhost:3000`
- **Frontend** — Vite dev server on `http://localhost:5173` (proxies `/api` requests to the backend)

Open `http://localhost:5173` in your browser to use the app.

## Project Structure

```
packages/
├── shared/          Zod schemas and TypeScript types shared across packages
├── server/          Fastify REST API (project CRUD, file upload/stream, FFmpeg export)
└── frontend/        Vue 3 SPA (project list, editor, timeline, video preview)
```

Project data is stored on disk under `data/projects/<id>/` with a `config.json` as the source of truth.

## npm Scripts

### Root (all workspaces)

| Script                 | Description                           |
| ---------------------- | ------------------------------------- |
| `npm run dev`          | Start dev servers for all workspaces  |
| `npm run lint`         | Run ESLint across the entire monorepo |
| `npm run lint:fix`     | Run ESLint with auto-fix              |
| `npm run format`       | Format all files with Prettier        |
| `npm run format:check` | Check formatting without writing      |
| `npm test`             | Run tests in all workspaces           |

### Per-workspace

Run any workspace script with `-w`:

```bash
npm run build -w packages/shared       # Build shared types
npm run build -w packages/server       # Build server
npm run build -w packages/frontend     # Build frontend for production
npm test -w packages/shared            # Test shared package
npm test -w packages/server            # Test server
```

## API Overview

All routes are prefixed with `/api/projects`.

| Method   | Route                                        | Description                                     |
| -------- | -------------------------------------------- | ----------------------------------------------- |
| `GET`    | `/api/projects`                              | List all projects                               |
| `POST`   | `/api/projects`                              | Create a new project                            |
| `GET`    | `/api/projects/:id`                          | Get project config                              |
| `PUT`    | `/api/projects/:id`                          | Update project config                           |
| `DELETE` | `/api/projects/:id`                          | Delete a project                                |
| `POST`   | `/api/projects/:id/sources`                  | Upload a source file                            |
| `DELETE` | `/api/projects/:id/sources/:sourceId`        | Delete a source file                            |
| `GET`    | `/api/projects/:id/sources/:sourceId/stream` | Stream a source video (supports range requests) |
| `POST`   | `/api/projects/:id/export`                   | Start an export job                             |
| `GET`    | `/api/projects/:id/export/status`            | Poll export progress                            |
| `GET`    | `/api/projects/:id/export/download`          | Download the exported MP4                       |

## License

[MIT](LICENSE)
