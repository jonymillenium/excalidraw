import { getVisibleSceneBounds } from "@excalidraw/excalidraw";

import type { AppState } from "@excalidraw/excalidraw/types";

import type { SavedView } from "./types";

const createId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export const captureVisibleRect = (appState: AppState) => {
  const [x1, y1, x2, y2] = getVisibleSceneBounds(appState);
  return {
    x: x1,
    y: y1,
    width: Math.max(1, x2 - x1),
    height: Math.max(1, y2 - y1),
  };
};

export const createSavedView = (
  canvasId: string,
  appState: AppState,
  existingViews: SavedView[],
  metadata?: { name?: string; description?: string },
): SavedView => {
  const now = Date.now();
  return {
    id: createId(),
    canvasId,
    name: metadata?.name?.trim() || `Vista ${existingViews.length + 1}`,
    description: metadata?.description?.trim() || undefined,
    order: existingViews.length,
    rect: captureVisibleRect(appState),
    transitionDurationMs: 400,
    createdAt: now,
    updatedAt: now,
  };
};

export const normalizeViewOrder = (views: SavedView[]) =>
  views
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((view, order) => ({ ...view, order }));

export const moveSavedView = (
  views: SavedView[],
  viewId: string,
  direction: -1 | 1,
) => {
  const ordered = normalizeViewOrder(views);
  const index = ordered.findIndex((view) => view.id === viewId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= ordered.length) {
    return ordered;
  }
  [ordered[index], ordered[nextIndex]] = [ordered[nextIndex], ordered[index]];
  return ordered.map((view, order) => ({ ...view, order }));
};
