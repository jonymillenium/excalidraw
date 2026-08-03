import {
  PRECISION_SNAPPING_VERSION,
  createEmptyCanvasPayload,
  type CanvasPayload,
} from "../domain/types";
import { getInitialEditorAppState } from "../domain/editorFeatures";

describe("workspace editor features", () => {
  it("enables precision snapping on new canvases", () => {
    const payload = createEmptyCanvasPayload();

    expect(payload.appState.objectsSnapModeEnabled).toBe(true);
    expect(payload.editorFeatures?.precisionSnappingVersion).toBe(
      PRECISION_SNAPPING_VERSION,
    );
  });

  it("migrates the former disabled default once", () => {
    const legacyPayload: CanvasPayload = {
      elements: [],
      appState: { objectsSnapModeEnabled: false },
      fileIds: [],
      views: [],
    };

    expect(getInitialEditorAppState(legacyPayload).objectsSnapModeEnabled).toBe(
      true,
    );
  });

  it("respects the preference after the migration marker is stored", () => {
    const payload: CanvasPayload = {
      elements: [],
      appState: { objectsSnapModeEnabled: false },
      fileIds: [],
      views: [],
      editorFeatures: {
        precisionSnappingVersion: PRECISION_SNAPPING_VERSION,
      },
    };

    expect(getInitialEditorAppState(payload).objectsSnapModeEnabled).toBe(
      false,
    );
  });
});
