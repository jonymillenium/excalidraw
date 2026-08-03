import { useCallback, useEffect, useRef } from "react";

import type { OrderedExcalidrawElement } from "@excalidraw/element/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";

import {
  PRECISION_SNAPPING_VERSION,
  type CanvasPayload,
} from "../domain/types";
import { createCanvasThumbnail } from "../services/canvasThumbnail";

import type { WorkspaceRepository } from "../storage/WorkspaceRepository";

export type SaveStatus = "saved" | "saving" | "error";

type LatestScene = {
  elements: readonly OrderedExcalidrawElement[];
  appState: AppState;
  files: BinaryFiles;
};

export const useAutosaveCanvas = ({
  repository,
  projectId,
  canvasId,
  key,
  views,
  viewFolders,
  colorProfiles,
  disabled,
  onStatusChange,
  delay = 850,
}: {
  repository: WorkspaceRepository;
  projectId: string;
  canvasId: string;
  key?: CryptoKey;
  views: CanvasPayload["views"];
  viewFolders: CanvasPayload["viewFolders"];
  colorProfiles: CanvasPayload["colorProfiles"];
  disabled?: boolean;
  onStatusChange: (status: SaveStatus, error?: Error) => void;
  delay?: number;
}) => {
  const latest = useRef<LatestScene | null>(null);
  const timer = useRef<number | null>(null);
  const activeSave = useRef<Promise<void> | null>(null);
  const viewsRef = useRef(views);
  viewsRef.current = views;
  const viewFoldersRef = useRef(viewFolders);
  viewFoldersRef.current = viewFolders;
  const colorProfilesRef = useRef(colorProfiles);
  colorProfilesRef.current = colorProfiles;

  const flush = useCallback(async () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    if (activeSave.current) {
      await activeSave.current;
    }
    if (!latest.current || disabled) {
      return;
    }
    const scene = latest.current;
    onStatusChange("saving");
    const save = repository
      .saveCanvas(
        projectId,
        canvasId,
        {
          elements: scene.elements,
          appState: scene.appState,
          fileIds: Object.keys(scene.files) as CanvasPayload["fileIds"],
          views: viewsRef.current,
          viewFolders: viewFoldersRef.current,
          colorProfiles: colorProfilesRef.current,
          editorFeatures: {
            precisionSnappingVersion: PRECISION_SNAPPING_VERSION,
          },
        },
        scene.files,
        key,
      )
      .then(async () => {
        try {
          const thumbnail = await createCanvasThumbnail(
            {
              elements: scene.elements,
              appState: scene.appState,
            },
            scene.files,
          );
          await repository.saveProjectThumbnail(projectId, canvasId, thumbnail);
        } catch (error) {
          console.warn(
            "No se pudo actualizar la miniatura del proyecto",
            error,
          );
        }
        onStatusChange("saved");
      })
      .catch((error: unknown) => {
        const normalized =
          error instanceof Error ? error : new Error("No se pudo guardar.");
        onStatusChange("error", normalized);
        throw normalized;
      })
      .finally(() => {
        activeSave.current = null;
      });
    activeSave.current = save;
    await save;
  }, [canvasId, disabled, key, onStatusChange, projectId, repository]);

  const schedule = useCallback(
    (
      elements: readonly OrderedExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles,
    ) => {
      latest.current = { elements, appState, files };
      if (disabled) {
        return;
      }
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
      timer.current = window.setTimeout(() => void flush(), delay);
    },
    [delay, disabled, flush],
  );

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        void flush();
      }
    };
    const handlePageHide = () => void flush();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handlePageHide);
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
      void flush();
    };
  }, [flush]);

  return { schedule, flush };
};
