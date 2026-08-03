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

`WorkspaceApp` resolves `/project/:projectId/canvas/:canvasId`, owns session-level project keys and unlocked-profile state, and coordinates dashboard/project navigation. A canvas switch flushes the pending save before changing the URL. The Excalidraw instance is remounted for every canvas ID, which isolates undo/redo history and prevents scene contamination.

## Domain and persistence

All persisted records carry `schemaVersion: 1`. The local profile registry stores identity, appearance, the optional profile-access verifier, and the active-profile pointer in `localStorage`. Every profile owns a separate IndexedDB database (`excalidraw-workspace` for the original profile and `excalidraw-workspace-profile-<id>` for additional profiles), so projects and settings never leak across profile switches. Each database contains:

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

IndexedDB connections close automatically on `versionchange`, allowing a profile database to be removed cleanly even if another application window had opened it.

## Legacy migration

On first launch the app checks standard Excalidraw local storage and the legacy file database. If a scene exists, it creates `Proyecto importado` / `Lienzo original`, copies scene state and referenced files, reads the new record back, and only then marks migration complete. Original keys and files are never deleted. The completion setting makes the migration idempotent.

## Import and export

`.excalidraw-workspace` is versioned JSON. Plain projects remain readable. Protected projects export the stored ciphertext without decrypting it and retain the same password. A collision remaps project/canvas IDs; protected collisions ask for the backup password because AES-GCM additional authenticated data includes those IDs.

Individual canvases can be downloaded directly as PNG, JPG, SVG, or `.excalidraw`. The standard Excalidraw load/save/image-export menu remains available as well.

`.xcalidraw-backup` is the application-level portable backup. The export dialog can include the active profile or every local profile and can include or omit workspace settings. Each profile entry carries its identity plus complete project exports; therefore projects include every canvas, saved view, embedded file, and protected ciphertext. Restore is non-destructive: it combines imported content with existing profiles and remaps colliding project/canvas IDs.

## macOS application

`desktop/` is a minimal hardened Electron host. It serves the production SPA from an internal secure `xcalidraw://` protocol, keeps Node.js disabled in renderer pages, opens external links in the default browser, and supplies native macOS menus/window lifecycle. `electron-builder` packages the web build and icon as an Apple Silicon `.dmg`. Browser and desktop storage use different application origins, so `.xcalidraw-backup` is the supported bridge between installations or Macs.

The packaging command embeds its Git commit and application version. The installed dashboard checks the configured public GitHub branch only when the user selects **Comprobar actualizaciones**; it performs no background polling. It compares that branch with the embedded commit and displays the number of published commits available. The check only notifies and links to the comparison: it never downloads or installs an update automatically.

## Per-profile appearance

Each profile stores an accent color, line style, and intensity. These values become CSS custom properties and body data attributes before the dashboard is rendered, so dashboard highlights, buttons, window contour, and automotive background lines stay consistent across sessions and backups without coupling the Excalidraw editor engine to a particular theme.

## Precision snapping

Workspace canvases enable object snapping by default and carry an `editorFeatures.precisionSnappingVersion` marker. A canvas without the marker is migrated once to the new enabled default; subsequent autosaves persist the marker so an explicit user preference remains respected. Smart guides align edges and centers during creation, movement, and resize, visualize equal gaps with measured high-contrast guides, and keep guide weight constant across zoom levels. In-place duplication preserves exact coordinates, while Option-drag rebuilds its snap cache around the duplicated selection so the stationary source remains a valid reference.

## Canvas authoring and organization

Each canvas persists six editable color-profile slots, including background, element color, and a measured contrast level. Applying a profile can affect only future elements or recolor existing strokes. Locked selections use Excalidraw's element-lock action rather than the toolbar's keep-tool-active state, so the padlock prevents translation and editing immediately.

Freehand strokes created in one drawing run are tracked until the user chooses to keep them as individual elements or save them under one shared group id. Saved views keep names, descriptions, ordering, hierarchical folder paths, and their explicit empty folders. Library assets similarly require a name, participate in text search, and carry portable folder/subfolder paths in `.excalidrawlib` data.

Canvas autosave renders a fitted, background-aware WebP thumbnail for every unprotected canvas. Project cards choose the most recent thumbnail. Internal workspace references use `xcalidraw://workspace` links stored on native grouped Excalidraw elements; a target may identify a project, canvas, or saved view. Resolving a view link opens a live, viewport-cropped preview and carries its view id through navigation so the destination restores the saved bounds and zoom after loading. Protected projects never persist thumbnail pixels. Workspace naming, folder, password, and destructive flows use application-owned accessible dialogs instead of browser prompts.

## OpenRouter AI

OpenRouter configuration is profile-scoped. The API key is encrypted with the profile-derived AES-GCM key and the UI retains only its last four-character hint. Reading, replacing, deleting, or changing configuration requires the profile administrator password; removing profile protection is rejected while a key exists. A profile password change re-encrypts the API key before the new protection record is committed.

The model catalog is read dynamically from OpenRouter and filtered for image input, text output, and structured-output support. Recommendations cover economical, balanced, high-fidelity, and Google-style omnimodal models, show declared input modalities and per-token prices, and treat routed/unknown prices as variable. Changing only the model never decrypts or replaces the stored API key.

The generation surface supports text-to-Mermaid, direct Mermaid-to-editable-elements, structured screenshot/photo reconstruction, and image/PDF/audio/video analysis into editable Mermaid. Analysis can run as executive, rapid-overview, or deep hierarchical profiles and returns a summary plus follow-up questions for a second pass. OpenRouter's reported request tokens and cost are aggregated into a 180-day profile ledger and displayed day by day.

`WorkspaceAIProvider` remains the provider-neutral domain boundary for future providers.

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
