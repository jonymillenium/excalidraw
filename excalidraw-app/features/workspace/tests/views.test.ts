import type { AppState } from "@excalidraw/excalidraw/types";

import {
  captureVisibleRect,
  createSavedView,
  moveSavedView,
  moveSavedViewWithinFolder,
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
    const view = createSavedView("canvas-one", appState, [], {
      name: "Introducción",
      description: "Vista general del flujo",
    });
    expect(view.name).toBe("Introducción");
    expect(view.description).toBe("Vista general del flujo");
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

  it("stores nested folders and reorders only inside the active folder", () => {
    const root = createSavedView("canvas-one", appState, [], {
      name: "Raíz",
    });
    const first = createSavedView("canvas-one", appState, [root], {
      name: "Primera",
      folderPath: ["Pitch", "Mercado"],
    });
    const second = createSavedView("canvas-one", appState, [root, first], {
      name: "Segunda",
      folderPath: ["Pitch", "Mercado"],
    });
    const moved = moveSavedViewWithinFolder(
      [root, first, second],
      second.id,
      -1,
      ["Pitch", "Mercado"],
    );

    expect(second.folderPath).toEqual(["Pitch", "Mercado"]);
    expect(moved.map((view) => view.id)).toEqual([
      root.id,
      second.id,
      first.id,
    ]);
  });
});
