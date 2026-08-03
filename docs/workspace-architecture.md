# Workspace architecture

## Purpose

The workspace layer turns the Excalidraw application into a local-first project organizer without changing the editor engine. The implementation lives in `excalidraw-app/features/workspace`; `packages/excalidraw` remains the drawing, selection, rendering, history, file import/export, and viewport engine. The small core edits are an English-locale loading guard and exposing the already bundled Virgil font in the picker; both are documented in `IMPLEMENTATION_NOTES.md`.

## Runtime shape

```text
WorkspaceApp
├── WorkspaceDashboard
│   └── project summaries only
└── ProjectWorkspace
    ├── CanvasSidebar
    ├── Excalidraw (remounted with key=canvasId)
    └── ViewsSidebar / presentation controls
```

`WorkspaceApp` resolves `/project/:projectId/canvas/:canvasId`, owns only session-level project keys, and coordinates dashboard/project navigation. A canvas switch flushes the pending save before changing the URL. The Excalidraw instance is remounted for every canvas ID, which isolates undo/redo history and prevents scene contamination.

## Domain and persistence

All persisted records carry `schemaVersion: 1`. The local profile registry stores only profile identity and the active-profile pointer in `localStorage`. Every profile owns a separate IndexedDB database (`excalidraw-workspace` for the original profile and `excalidraw-workspace-profile-<id>` for additional profiles), so projects and settings never leak across profile switches. Each database contains:

- `workspace-projects`: public summaries, protection parameters, and an envelope for private project metadata.
- `workspace-canvases`: canvas names/order plus a plain or encrypted scene envelope.
- `workspace-files`: one record per image/file, namespaced by project, canvas, and file ID.
- `workspace-settings`: migration and last-opened context.
- `workspace-thumbnails`: reserved for deferred thumbnails.

The UI depends on `WorkspaceRepository`, never on IndexedDB. Project lists do not decrypt or load scene payloads. Files are fingerprinted and only new or changed files are written during autosave.

Critical project-wide transformations read and validate the current version, calculate all new encrypted envelopes, then replace project/canvas/file records in one IndexedDB transaction. A failed transaction leaves the previous records intact.

## Autosave

`useAutosaveCanvas` listens to Excalidraw `onChange` and saves after 850 ms of inactivity. It exposes `flush()` for canvas/project changes and also flushes on `visibilitychange` and `pagehide`. Save state is visible as `Guardando…`, `Guardado`, or `Error al guardar`; quota failures include an emergency-backup recommendation.

## Saved views

A saved view is a scene-coordinate rectangle, not a set of elements. `getVisibleSceneBounds()` captures the current visible area. Opening a view calls:

```ts
excalidrawAPI.setViewport({
  target: view.rect,
  fit: "contain",
  animation: { duration: view.transitionDurationMs },
  offsets: { ui: true },
});
```

Each view also stores a user-assigned name and optional description. The list exposes visible up/down controls and persists normalized order. The default transition duration is 400 ms. Presentation mode uses that order, disables scene editing, forces Excalidraw's laser tool, hides workspace panels, supports arrow keys, and exits with Escape. Navigating does not change elements or create an undo entry.

## Multi-tab behavior

Each active canvas obtains a best-effort `BroadcastChannel` lease. A second tab that detects an existing owner opens the canvas in read-only mode and does not autosave. This is edit exclusion, not collaboration.

## Legacy migration

On first launch the app checks standard Excalidraw local storage and the legacy file database. If a scene exists, it creates `Proyecto importado` / `Lienzo original`, copies scene state and referenced files, reads the new record back, and only then marks migration complete. Original keys and files are never deleted. The completion setting makes the migration idempotent.

## Import and export

`.excalidraw-workspace` is versioned JSON. Plain projects remain readable. Protected projects export the stored ciphertext without decrypting it and retain the same password. A collision remaps project/canvas IDs; protected collisions ask for the backup password because AES-GCM additional authenticated data includes those IDs.

Individual canvases can be downloaded directly as PNG, JPG, SVG, or `.excalidraw`. The standard Excalidraw load/save/image-export menu remains available as well.

`.xcalidraw-backup` is the application-level portable backup. The export dialog can include the active profile or every local profile and can include or omit workspace settings. Each profile entry carries its identity plus complete project exports; therefore projects include every canvas, saved view, embedded file, and protected ciphertext. Restore is non-destructive: it combines imported content with existing profiles and remaps colliding project/canvas IDs.

## macOS application

`desktop/` is a minimal hardened Electron host. It serves the production SPA from an internal secure `xcalidraw://` protocol, keeps Node.js disabled in renderer pages, opens external links in the default browser, and supplies native macOS menus/window lifecycle. `electron-builder` packages the web build and icon as an Apple Silicon `.dmg`. Browser and desktop storage use different application origins, so `.xcalidraw-backup` is the supported bridge between installations or Macs.

## Future AI extension

`WorkspaceAIProvider` is a provider-neutral interface in the domain layer. The MVP has no implementation, API key, UI, remote call, or persistence coupling.

## Local development

Recommended versions are Node.js 20 LTS and Yarn 1.22.22.

```bash
yarn
yarn start
```

Open the Vite localhost URL. Password protection requires a secure context; browsers treat `localhost` as secure.

Validation commands:

```bash
yarn test:typecheck
yarn test:app --watch=false
yarn test:code
yarn build:app
```
