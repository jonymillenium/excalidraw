# Workspace fork implementation notes

## Base and branch

- Upstream base SHA: `786ab266ff3a9cfffaed16804cf9132b44bc08ae`
- Feature branch: `feature/workspaces-projects-views-security`
- License: the upstream MIT license and copyright notices are unchanged.

The local environment supplied Node.js 24.14.0 rather than the preferred Node.js 20 LTS. The upstream package declares `node >=18`; baseline typecheck and application build passed before changes. Yarn 1.22.22 was used through Corepack.

## Architectural decisions

1. The workspace itself is an application feature using public editor APIs. The only core change is a guarded `en` locale fast path in `i18n.ts`: the fallback is already statically imported, and avoiding a redundant dynamic import prevents Vite errors when this repository path contains `|`. It does not alter editor behavior or other locales.
2. Canvas IDs remount Excalidraw, guaranteeing isolated in-session history.
3. Viewports persist scene rectangles from `getVisibleSceneBounds`, making them resilient to a different window size.
4. Scene/app-state envelopes and binary files are separate so autosave does not re-encrypt unchanged images.
5. Project keys are non-exportable `CryptoKey` objects kept only in memory.
6. Protected exports preserve ciphertext. Protected import collisions require the password to rebind AAD to new IDs.
7. The default setting reopens the last used project/canvas. Navigating back to `/` still provides the dashboard.
8. BroadcastChannel provides an edit lease; secondary tabs are read-only.

## Main implementation files

- `excalidraw-app/features/workspace/WorkspaceApp.tsx`
- `excalidraw-app/features/workspace/components/ProjectWorkspace.tsx`
- `excalidraw-app/features/workspace/storage/IndexedDBWorkspaceRepository.ts`
- `excalidraw-app/features/workspace/crypto/projectCrypto.ts`
- `excalidraw-app/features/workspace/hooks/useAutosaveCanvas.ts`
- `excalidraw-app/features/workspace/domain/views.ts`
- `excalidraw-app/features/workspace/services/projectTransfer.ts`
- `excalidraw-app/features/workspace/services/legacyMigration.ts`

## Known MVP limitations

- Saved-view thumbnails use a lightweight diagrammatic placeholder; deferred rendered thumbnails can be added to the reserved thumbnail store.
- Multi-tab ownership is best effort and intentionally does not provide collaborative merging.
- The project name remains visible for locked projects, as documented in the PRD security decision.
- Browser storage is device/profile-local; users should export backups before clearing site data.
- No AI behavior is implemented; only the provider boundary exists.
