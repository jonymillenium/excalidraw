import {
  MIME_TYPES,
  exportToBlob,
  exportToSvg,
  serializeAsJSON,
} from "@excalidraw/excalidraw";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

export type CanvasExportFormat = "png" | "jpg" | "svg" | "excalidraw";

const safeFilename = (name: string) =>
  name
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ") || "lienzo";

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

export const exportCanvas = async (
  api: ExcalidrawImperativeAPI,
  canvasName: string,
  format: CanvasExportFormat,
) => {
  const elements = api.getSceneElements();
  const appState = api.getAppState();
  const files = api.getFiles();
  const filename = safeFilename(canvasName);

  if (format === "svg") {
    const svg = await exportToSvg({ elements, appState, files });
    downloadBlob(
      new Blob([svg.outerHTML], { type: MIME_TYPES.svg }),
      `${filename}.svg`,
    );
    return;
  }

  if (format === "excalidraw") {
    downloadBlob(
      new Blob([serializeAsJSON(elements, appState, files, "local")], {
        type: MIME_TYPES.excalidraw,
      }),
      `${filename}.excalidraw`,
    );
    return;
  }

  const mimeType = format === "jpg" ? MIME_TYPES.jpg : MIME_TYPES.png;
  const blob = await exportToBlob({ elements, appState, files, mimeType });
  downloadBlob(blob, `${filename}.${format}`);
};
