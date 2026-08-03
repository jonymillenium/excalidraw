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

type FlushOptions = {
  silent?: boolean;
  updateThumbnail?: boolean;
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
  delay = 1500,
  thumbnailDelay = 6000,
  statusDelay = 250,
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
  thumbnailDelay?: number;
  statusDelay?: number;
}) => {
  const latest = useRef<LatestScene | null>(null);
  const timer = useRef<number | null>(null);
  const thumbnailTimer = useRef<number | null>(null);
  const thumbnailScene = useRef<LatestScene | null>(null);
  const statusTimer = useRef<number | null>(null);
  const activeSave = useRef<Promise<void> | null>(null);
  const mounted = useRef(true);
  const viewsRef = useRef(views);
  viewsRef.current = views;
  const viewFoldersRef = useRef(viewFolders);
  viewFoldersRef.current = viewFolders;
  const colorProfilesRef = useRef(colorProfiles);
  colorProfilesRef.current = colorProfiles;

  const scheduleThumbnail = useCallback(
    (scene: LatestScene) => {
      thumbnailScene.current = scene;
      if (thumbnailTimer.current !== null) {
        window.clearTimeout(thumbnailTimer.current);
      }
      thumbnailTimer.current = window.setTimeout(() => {
        thumbnailTimer.current = null;
        const latestScene = thumbnailScene.current;
        thumbnailScene.current = null;
        if (!latestScene) {
          return;
        }
        void createCanvasThumbnail(
          {
            elements: latestScene.elements,
            appState: latestScene.appState,
          },
          latestScene.files,
        )
          .then((thumbnail) =>
            repository.saveProjectThumbnail(projectId, canvasId, thumbnail),
          )
          .catch((error) => {
            console.warn(
              "No se pudo actualizar la miniatura del proyecto",
              error,
            );
          });
      }, thumbnailDelay);
    },
    [canvasId, projectId, repository, thumbnailDelay],
  );

  const flush = useCallback(
    async ({ silent = false, updateThumbnail = true }: FlushOptions = {}) => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
      if (activeSave.current) {
        try {
          await activeSave.current;
        } catch {
          // The failed scene is restored below and retried with the newest one.
        }
      }
      if (!latest.current || disabled) {
        return;
      }
      const scene = latest.current;
      latest.current = null;
      if (statusTimer.current !== null) {
        window.clearTimeout(statusTimer.current);
      }
      if (!silent) {
        statusTimer.current = window.setTimeout(() => {
          statusTimer.current = null;
          if (mounted.current) {
            onStatusChange("saving");
          }
        }, statusDelay);
      }
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
        .then(() => {
          if (statusTimer.current !== null) {
            window.clearTimeout(statusTimer.current);
            statusTimer.current = null;
          }
          if (!silent && mounted.current) {
            onStatusChange("saved");
          }
          if (updateThumbnail && mounted.current) {
            scheduleThumbnail(scene);
          }
        })
        .catch((error: unknown) => {
          if (statusTimer.current !== null) {
            window.clearTimeout(statusTimer.current);
            statusTimer.current = null;
          }
          if (!latest.current) {
            latest.current = scene;
          }
          const normalized =
            error instanceof Error ? error : new Error("No se pudo guardar.");
          if (!silent && mounted.current) {
            onStatusChange("error", normalized);
          }
          throw normalized;
        })
        .finally(() => {
          activeSave.current = null;
        });
      activeSave.current = save;
      await save;
    },
    [
      canvasId,
      disabled,
      key,
      onStatusChange,
      projectId,
      repository,
      scheduleThumbnail,
      statusDelay,
    ],
  );

  const schedule = useCallback(
    (
      elements: readonly OrderedExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles,
    ) => {
      latest.current = { elements, appState, files };
      if (thumbnailTimer.current !== null) {
        window.clearTimeout(thumbnailTimer.current);
        thumbnailTimer.current = null;
        thumbnailScene.current = null;
      }
      if (disabled) {
        return;
      }
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
      timer.current = window.setTimeout(
        () => void flush().catch(() => undefined),
        delay,
      );
    },
    [delay, disabled, flush],
  );

  useEffect(() => {
    mounted.current = true;
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        void flush({ silent: true }).catch(() => undefined);
      }
    };
    const handlePageHide = () =>
      void flush({ silent: true, updateThumbnail: false }).catch(
        () => undefined,
      );
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      mounted.current = false;
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handlePageHide);
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
      if (statusTimer.current !== null) {
        window.clearTimeout(statusTimer.current);
      }
      if (thumbnailTimer.current !== null) {
        window.clearTimeout(thumbnailTimer.current);
      }
      void flush({ silent: true, updateThumbnail: false }).catch(
        () => undefined,
      );
    };
  }, [flush]);

  return { schedule, flush };
};
