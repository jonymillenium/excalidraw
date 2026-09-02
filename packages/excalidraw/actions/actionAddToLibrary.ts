import { LIBRARY_DISABLED_TYPES } from "@excalidraw/common";
import { deepCopyElement } from "@excalidraw/element";

import { CaptureUpdateAction } from "@excalidraw/element";

import { t } from "../i18n";
import { addToLibraryDialogAtom } from "../components/AddToLibraryDialog";
import { editorJotaiStore } from "../editor-jotai";

import { register } from "./register";

export const actionAddToLibrary = register({
  name: "addToLibrary",
  trackEvent: { category: "element" },
  perform: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements({
      selectedElementIds: appState.selectedElementIds,
      includeBoundTextElement: true,
      includeElementsInFrames: true,
    });

    for (const type of LIBRARY_DISABLED_TYPES) {
      if (selectedElements.some((element) => element.type === type)) {
        return {
          captureUpdate: CaptureUpdateAction.EVENTUALLY,
          appState: {
            ...appState,
            errorMessage: t(`errors.libraryElementTypeError.${type}`),
          },
        };
      }
    }

    editorJotaiStore.set(
      addToLibraryDialogAtom,
      selectedElements.map(deepCopyElement),
    );

    return {
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
  label: "labels.addToLibrary",
});
