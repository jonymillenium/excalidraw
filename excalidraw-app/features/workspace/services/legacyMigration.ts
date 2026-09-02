import { clearAppStateForLocalStorage } from "@excalidraw/excalidraw/appState";
import { createStore, entries } from "idb-keyval";

import type { ExcalidrawElement, FileId } from "@excalidraw/element/types";
import type {
  AppState,
  BinaryFileData,
  BinaryFiles,
} from "@excalidraw/excalidraw/types";

import { STORAGE_KEYS } from "../../../app_constants";

import type { WorkspaceRepository } from "../storage/WorkspaceRepository";

const legacyFilesStore = createStore("files-db", "files-store");

export const migrateLegacyScene = async (
  repository: WorkspaceRepository,
): Promise<boolean> => {
  const settings = await repository.getSettings();
  if (settings.legacyMigrationCompleted) {
    return false;
  }
  let elements: readonly ExcalidrawElement[] = [];
  let appState: Partial<AppState> = {};
  try {
    const rawElements = localStorage.getItem(
      STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS,
    );
    const rawAppState = localStorage.getItem(
      STORAGE_KEYS.LOCAL_STORAGE_APP_STATE,
    );
    if (rawElements) {
      elements = JSON.parse(rawElements) as ExcalidrawElement[];
    }
    if (rawAppState) {
      appState = clearAppStateForLocalStorage(
        JSON.parse(rawAppState) as Partial<AppState>,
      );
    }
  } catch {
    throw new Error(
      "La escena anterior existe, pero no se pudo leer. No se eliminó ningún dato.",
    );
  }
  if (!elements.length) {
    await repository.updateSettings({ legacyMigrationCompleted: true });
    return false;
  }
  const created = await repository.createProject({
    name: "Proyecto importado",
  });
  await repository.renameCanvas(
    created.project.id,
    created.canvas.id,
    "Lienzo original",
  );
  const fileIds = new Set(
    elements
      .map((element) =>
        "fileId" in element ? (element.fileId as FileId | null) : null,
      )
      .filter((id): id is FileId => !!id),
  );
  const files = {} as BinaryFiles;
  try {
    const legacyFiles = (await entries(legacyFilesStore)) as [
      FileId,
      BinaryFileData,
    ][];
    legacyFiles.forEach(([id, file]) => {
      if (fileIds.has(id)) {
        files[id] = file;
      }
    });
  } catch {
    // The scene can still be migrated and surfaces missing-file placeholders.
  }
  await repository.saveCanvas(
    created.project.id,
    created.canvas.id,
    { elements, appState, fileIds: [...fileIds], views: [] },
    files,
  );
  const verified = await repository.loadCanvas(
    created.project.id,
    created.canvas.id,
  );
  if (!verified || verified.payload.elements.length !== elements.length) {
    throw new Error(
      "La migración no pudo verificarse. Los datos anteriores siguen intactos.",
    );
  }
  await repository.updateSettings({ legacyMigrationCompleted: true });
  return true;
};
