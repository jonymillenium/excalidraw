import { exportToCanvas, getNonDeletedElements } from "@excalidraw/excalidraw";
import { newFrameElement } from "@excalidraw/element";

import type { BinaryFiles } from "@excalidraw/excalidraw/types";

import type { CanvasPayload, SavedView } from "../domain/types";

export const fitRect = (
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  padding = 0,
) => {
  const availableWidth = Math.max(1, targetWidth - padding * 2);
  const availableHeight = Math.max(1, targetHeight - padding * 2);
  const scale = Math.min(
    availableWidth / Math.max(1, sourceWidth),
    availableHeight / Math.max(1, sourceHeight),
  );
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return {
    x: (targetWidth - width) / 2,
    y: (targetHeight - height) / 2,
    width,
    height,
  };
};

export const createCanvasThumbnail = async (
  payload: Pick<CanvasPayload, "elements" | "appState">,
  files: BinaryFiles,
) => {
  const elements = getNonDeletedElements(payload.elements);
  if (!elements.length) {
    return undefined;
  }

  const backgroundColor = payload.appState.viewBackgroundColor ?? "#ffffff";
  const source = await exportToCanvas({
    elements,
    files,
    appState: {
      ...payload.appState,
      exportBackground: true,
      viewBackgroundColor: backgroundColor,
    },
    exportPadding: 6,
    maxWidthOrHeight: 1200,
  });
  const width = 640;
  const height = 320;
  const target = document.createElement("canvas");
  target.width = width;
  target.height = height;
  const context = target.getContext("2d");
  if (!context) {
    return undefined;
  }
  context.fillStyle = backgroundColor;
  context.fillRect(0, 0, width, height);
  const fitted = fitRect(source.width, source.height, width, height, 6);
  context.drawImage(source, fitted.x, fitted.y, fitted.width, fitted.height);
  return target.toDataURL("image/webp", 0.82);
};

export const createViewThumbnail = async (
  payload: Pick<CanvasPayload, "elements" | "appState">,
  files: BinaryFiles,
  view: Pick<SavedView, "rect">,
) => {
  const elements = getNonDeletedElements(payload.elements);
  const backgroundColor = payload.appState.viewBackgroundColor ?? "#ffffff";
  const frame = newFrameElement({
    x: view.rect.x,
    y: view.rect.y,
    width: Math.max(1, view.rect.width),
    height: Math.max(1, view.rect.height),
  });
  const source = await exportToCanvas({
    elements: [...elements, frame],
    files,
    appState: {
      ...payload.appState,
      exportBackground: true,
      viewBackgroundColor: backgroundColor,
    },
    exportingFrame: frame,
    exportPadding: 0,
    maxWidthOrHeight: 1200,
  });
  const width = 640;
  const height = 320;
  const target = document.createElement("canvas");
  target.width = width;
  target.height = height;
  const context = target.getContext("2d");
  if (!context) {
    return undefined;
  }
  context.fillStyle = backgroundColor;
  context.fillRect(0, 0, width, height);
  const fitted = fitRect(source.width, source.height, width, height);
  context.drawImage(source, fitted.x, fitted.y, fitted.width, fitted.height);
  return target.toDataURL("image/webp", 0.84);
};
