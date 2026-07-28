# Asset Indexer

<img src="screen.png" width="800" />

Intelligent asset indexer for game developers. A desktop application to organize, browse, and manage game asset libraries with real-time file watching, rich previews, and powerful tagging and filtering capabilities.

## Features

- **Library Management** -- Add local folders as libraries, configure per-library ignore patterns via regex, and rescan on demand
- **Real-time File Watching** -- Automatic index updates when files are added, modified, or removed on disk
- **7 Asset Categories** -- 3D models, images, materials, audio, scripts, videos, and documents
- **Image Thumbnails** -- Direct file loading via custom protocol, no IPC overhead
- **Rich Previews** -- Images, audio with waveform visualization (Web Audio API), video playback, and code/text viewer
- **Tag System** -- Create custom-colored tags, assign to assets, and filter by tag
- **Collections** -- Group assets into named collections for project-based organization
- **Favorites** -- Star assets for quick access
- **Search and Filter** -- By name, category, library, tag, or collection
- **Sort Options** -- Name, size, modified date, or type
- **Grid and List Views** -- Toggle between visual grid and compact list layouts
- **Custom Frameless UI** -- Dark theme with purple accent, built with vanilla HTML/CSS/JS

## Supported Formats

| Category | Extensions |
|---|---|
| 3D Models | `.fbx`, `.obj`, `.gltf`, `.glb`, `.blend`, `.3ds`, `.dae`, `.stl`, `.ply` |
| Images | `.png`, `.jpg`, `.jpeg`, `.tga`, `.tiff`, `.tif`, `.bmp`, `.gif`, `.psd`, `.hdr`, `.exr`, `.dds`, `.ktx`, `.webp`, `.ico` |
| Materials | `.mat`, `.material`, `.shader`, `.mtl` |
| Audio | `.wav`, `.mp3`, `.ogg`, `.flac`, `.aiff`, `.m4a`, `.wma` |
| Scripts | `.cs`, `.js`, `.ts`, `.py`, `.lua`, `.cpp`, `.h` |
| Videos | `.mp4`, `.avi`, `.mov`, `.wmv`, `.mkv`, `.webm` |
| Documents | `.pdf`, `.doc`, `.docx`, `.txt`, `.md`, `.rtf` |

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Electron 30.x |
| Language | JavaScript |
| Database | SQLite via better-sqlite3 |
| File Watching | Chokidar 3.6 |
| Packaging | electron-builder (NSIS installer) |
| UI | Vanilla HTML/CSS/JS, Inter font |

## Project Structure

```
AssetIndexer/
  main.js              # Electron main process (database, IPC, file scanning, watchers)
  preload.js           # Context bridge for secure IPC
  package.json         # Dependencies and build configuration
  renderer/
    index.html         # Application markup (three-panel layout)
    app.js             # Renderer logic (state, DOM, events, waveform)
    styles.css         # Styling (dark theme, responsive breakpoints)
```

## Getting Started

### Prerequisites

- Node.js (v18 or later recommended)
- npm

### Installation

```bash
git clone https://github.com/manuel-di-iorio/asset-indexer.git
cd asset-indexer
npm install
```

### Development

```bash
npm start
```

### Build

Package the application as a Windows installer:

```bash
npm run build
```

The output will be available in the `dist/` directory.

## Architecture

The application follows Electron's main/renderer process model with context isolation enabled (`contextIsolation: true`, `nodeIntegration: false`).

**Main Process** (`main.js`) handles SQLite database operations (6 tables with indexes), recursive file scanning with regex-based ignore patterns, Chokidar file watchers per library, and 25+ IPC handlers.

**Renderer Process** (`renderer/`) manages the UI state, DOM rendering, direct file loading via `file://` protocol for images/video previews, and canvas-based audio waveform visualization. Communication with the main process occurs exclusively through the preload bridge (`preload.js`).

The SQLite database is stored at the Electron `userData` path (`assets.db`) and uses WAL mode for concurrent read/write performance.

## Database Schema

```
libraries          id, path (UNIQUE), name, ignore_regex, created_at
assets             id, library_id (FK), file_path (UNIQUE), file_name, file_ext,
                   file_size, modified_date, created_date, category, is_favorite
tags               id, name (UNIQUE), color
asset_tags         asset_id, tag_id (composite PK, cascading deletes)
collections        id, name (UNIQUE), description
asset_collections  asset_id, collection_id (composite PK, cascading deletes)
```

## License

MIT
