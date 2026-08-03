import { PRECISION_SNAPPING_VERSION, type CanvasPayload } from "./types";

/**
 * Older canvases persisted Excalidraw's former `false` default without the
 * user explicitly opting out. Enable precision snapping once for those
 * canvases; after the next autosave, the version marker lets us respect any
 * later preference change.
 */
export const getInitialEditorAppState = (payload: CanvasPayload) => ({
  ...payload.appState,
  objectsSnapModeEnabled:
    payload.editorFeatures?.precisionSnappingVersion ===
    PRECISION_SNAPPING_VERSION
      ? payload.appState.objectsSnapModeEnabled ?? true
      : true,
});
