import type { AppState } from "@excalidraw/excalidraw/types";

import {
  captureVisibleRect,
  createSavedView,
  moveSavedView,
} from "../domain/views";

const appState = {
  scrollX: -200,
  scrollY: 100,
  width: 1200,
  height: 800,
  zoom: { value: 2 },
} as AppState;

describe("saved views", () => {
  it("captures the visible scene rectangle independently of raw viewport size", () => {
    expect(captureVisibleRect(appState)).toEqual({
      x: 200,
      y: -100,
      width: 600,
      height: 400,
    });
  });

  it("creates named, ordered views with the default transition", () => {
    const view = createSavedView("canvas-one", appState, []);
    expect(view.name).toBe("Vista 1");
    expect(view.order).toBe(0);
    expect(view.transitionDurationMs).toBe(400);
    expect(view.canvasId).toBe("canvas-one");
  });

  it("moves and normalizes view order", () => {
    const first = createSavedView("canvas-one", appState, []);
    const second = createSavedView("canvas-one", appState, [first]);
    const moved = moveSavedView([first, second], second.id, -1);
    expect(moved.map((view) => view.id)).toEqual([second.id, first.id]);
    expect(moved.map((view) => view.order)).toEqual([0, 1]);
  });
});
