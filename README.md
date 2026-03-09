# Video Editor

A web-based video editor built with Vue 3 and Fastify. Upload video, image, and audio files, arrange clips on a multi-track timeline, add text overlays with animations, preview the result in real time, and export the final cut as an MP4.

## Features

- **Project management** — Create, rename, and delete editing projects
- **File upload** — Upload video, image, and audio source files (up to 500 MB each)
- **Multi-media support** — Video (MP4, WebM, MOV, AVI, MKV), images (PNG, JPG, GIF, WebP, BMP, TIFF), and audio (MP3, WAV, AAC, OGG, FLAC, M4A, WMA)
- **Timeline editing** — Multi-track timeline with drag-and-drop, clip reordering, trimming in/out points, splitting clips at the playhead (`C` key), and zoom control
- **Audio mixing** — Dedicated audio tracks with per-clip volume (0-150%), fade in/out envelopes, and smooth volume transitions between adjacent clips
- **Image clips** — Images placed on the video track with a configurable duration (default 5s)
- **Text overlays** — Add text tracks with styled text clips (10 bundled fonts, font size, color, bold/italic), positioned via drag in the preview or percentage sliders in the inspector
- **Text animations** — Entrance and exit animations for text clips: fade, slide (left/right/top/bottom), and typewriter (center or left-aligned)
- **Video preview** — Real-time playback driven by the timeline playhead with play/pause, seeking, scrubbing, volume control, and live text overlay rendering with animation preview
- **Thumbnails** — Auto-generated thumbnails for video (6 frames) and image (1 frame) sources
- **Bundled fonts** — 10 font families with bold/italic variants served via the API for both preview and FFmpeg export
- **Export** — Render the full timeline to a single MP4 using FFmpeg (H.264 + AAC), with progress tracking, gap filling, multi-track audio mixing, text overlay rendering, and download

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

This installs dependencies for all workspaces (`packages/shared`, `packages/server`, `packages/frontend`, `packages/cli`).

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
├── frontend/        Vue 3 SPA (project list, editor, timeline, video preview)
└── cli/             CLI tool for listing projects and running exports without the UI
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

## CLI Usage

The `@video-editor/cli` package provides a command-line interface for listing projects and running exports without the web UI. It requires the shared package to be built first.

```bash
npm run build -w packages/shared
```

### List projects

```bash
npx tsx packages/cli/src/index.ts list
```

### Export a project by ID

```bash
npx tsx packages/cli/src/index.ts export <project-id>
```

Progress is printed to stdout as the export runs. The output file is saved to `data/projects/<project-id>/export.mp4`.

### Export from a standalone JSON config

You can also pass an arbitrary config file instead of a project ID:

```bash
npx tsx packages/cli/src/index.ts export --config path/to/config.json
```

The config file must conform to the project config schema (see `packages/shared/src/schema.ts`). Source file paths inside the config are resolved relative to `data/projects/<id>/`.

### Set a custom data directory

Both the server and the CLI share the same data directory configuration defined in `packages/shared/src/config.ts`. By default it resolves to `data/projects/` at the repository root, regardless of the current working directory.

Override this with the `VIDEO_EDITOR_DATA_DIR` environment variable (applies to both the server and CLI):

```bash
VIDEO_EDITOR_DATA_DIR=/path/to/data npx tsx packages/cli/src/index.ts list
VIDEO_EDITOR_DATA_DIR=/path/to/data npm run dev -w packages/server
```

## API Overview

All project routes are prefixed with `/api/projects`. Font routes are under `/api/fonts`.

| Method   | Route                                              | Description                                                    |
| -------- | -------------------------------------------------- | -------------------------------------------------------------- |
| `GET`    | `/api/projects`                                    | List all projects                                              |
| `POST`   | `/api/projects`                                    | Create a new project                                           |
| `GET`    | `/api/projects/:id`                                | Get project config                                             |
| `PUT`    | `/api/projects/:id`                                | Update project config (rename, modify timeline, etc.)          |
| `DELETE` | `/api/projects/:id`                                | Delete a project                                               |
| `POST`   | `/api/projects/:id/sources`                        | Upload a source file (multipart, max 500 MB)                   |
| `DELETE` | `/api/projects/:id/sources/:sourceId`              | Delete a source file                                           |
| `GET`    | `/api/projects/:id/sources/:sourceId/stream`       | Stream a source file (supports range requests)                 |
| `GET`    | `/api/projects/:id/sources/:sourceId/thumb/:index` | Get a thumbnail for a source (auto-generated on first request) |
| `POST`   | `/api/projects/:id/export`                         | Start an export job                                            |
| `GET`    | `/api/projects/:id/export/status`                  | Poll export progress                                           |
| `GET`    | `/api/projects/:id/export/download`                | Download the exported MP4                                      |
| `GET`    | `/api/fonts`                                       | List all bundled fonts with metadata                           |
| `GET`    | `/api/fonts/:filename`                             | Download a font file (TTF)                                     |

## Bundled Fonts

10 font families are included for text overlays. Each font is available in the preview and used by FFmpeg during export.

| Font             | Regular | Bold | Italic | Bold Italic |
| ---------------- | ------- | ---- | ------ | ----------- |
| Roboto           | yes     | yes  | yes    | yes         |
| Open Sans        | yes     | yes  | yes    | yes         |
| Montserrat       | yes     | yes  | yes    | yes         |
| Lato             | yes     | yes  | yes    | yes         |
| Oswald           | yes     | yes  | -      | -           |
| Playfair Display | yes     | yes  | yes    | yes         |
| Source Code Pro  | yes     | yes  | yes    | yes         |
| Bebas Neue       | yes     | -    | -      | -           |
| Permanent Marker | yes     | -    | -      | -           |
| Dancing Script   | yes     | yes  | -      | -           |

## Export Details

The export pipeline renders the full timeline into a single MP4 file:

- **Video codec**: H.264 (libx264), medium preset, CRF 23
- **Audio codec**: AAC at 192 kbps, 48 kHz sample rate
- **Format**: MP4 with `faststart` for web streaming
- **Gap handling**: Timeline gaps are filled with black frames and silent audio
- **Audio mixing**: Video-track audio and audio-track clips are mixed together; per-clip volume, fade envelopes, and adjacent clip transitions are applied via per-frame expressions
- **Text rendering**: Text overlays are rendered using FFmpeg's `drawtext` filter chain, supporting fade (alpha expression), slide (animated x/y), and typewriter (chained filters per character)
- **Image clips**: Images are looped for their configured duration
- **Text/audio-only**: Exports with no video clips generate a black background; exports with no audio generate silence

## Project Config Schema Reference

The project configuration is stored as `data/projects/<id>/config.json` and serves as the single source of truth. The full schema reference with field-by-field documentation, validation rules, and a complete JSON example is available in **[docs/schema-reference.md](docs/schema-reference.md)**. It is designed so that an AI agent or external tool can generate valid configurations programmatically.

The Zod schema source is at `packages/shared/src/schema.ts`.

## License

[MIT](LICENSE)
