import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";

import { useAutosaveCanvas } from "../hooks/useAutosaveCanvas";
import { createCanvasThumbnail } from "../services/canvasThumbnail";

import type { WorkspaceRepository } from "../storage/WorkspaceRepository";

vi.mock("../services/canvasThumbnail", () => ({
  createCanvasThumbnail: vi.fn().mockResolvedValue("data:image/webp;base64,qa"),
}));

describe("useAutosaveCanvas", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("saves a pending scene once and defers its thumbnail until idle", async () => {
    const repository = {
      saveCanvas: vi.fn().mockResolvedValue(undefined),
      saveProjectThumbnail: vi.fn().mockResolvedValue(undefined),
    } as unknown as WorkspaceRepository;
    const onStatusChange = vi.fn();
    const { result, unmount } = renderHook(() =>
      useAutosaveCanvas({
        repository,
        projectId: "project-1",
        canvasId: "canvas-1",
        views: [],
        viewFolders: [],
        colorProfiles: [],
        onStatusChange,
        delay: 1000,
        thumbnailDelay: 500,
        statusDelay: 50,
      }),
    );

    act(() => result.current.schedule([], {} as AppState, {} as BinaryFiles));
    await act(async () => result.current.flush());

    expect(repository.saveCanvas).toHaveBeenCalledOnce();
    expect(createCanvasThumbnail).not.toHaveBeenCalled();
    expect(onStatusChange).toHaveBeenCalledWith("saved");
    expect(onStatusChange).not.toHaveBeenCalledWith("saving");

    await act(async () => {
      await result.current.flush();
      await result.current.flush();
    });
    expect(repository.saveCanvas).toHaveBeenCalledOnce();

    act(() => result.current.schedule([], {} as AppState, {} as BinaryFiles));
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(createCanvasThumbnail).not.toHaveBeenCalled();

    await act(async () => result.current.flush());
    expect(repository.saveCanvas).toHaveBeenCalledTimes(2);

    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(createCanvasThumbnail).toHaveBeenCalledOnce();
    expect(repository.saveProjectThumbnail).toHaveBeenCalledOnce();
    unmount();
  });

  it("restores a failed scene so a later flush can retry it", async () => {
    const repository = {
      saveCanvas: vi
        .fn()
        .mockRejectedValueOnce(new Error("storage unavailable"))
        .mockResolvedValueOnce(undefined),
      saveProjectThumbnail: vi.fn().mockResolvedValue(undefined),
    } as unknown as WorkspaceRepository;
    const { result, unmount } = renderHook(() =>
      useAutosaveCanvas({
        repository,
        projectId: "project-1",
        canvasId: "canvas-1",
        views: [],
        viewFolders: [],
        colorProfiles: [],
        onStatusChange: vi.fn(),
        delay: 100,
      }),
    );

    act(() => result.current.schedule([], {} as AppState, {} as BinaryFiles));
    let saveError: unknown;
    await act(async () => {
      try {
        await result.current.flush();
      } catch (error) {
        saveError = error;
      }
    });
    expect(saveError).toEqual(new Error("storage unavailable"));

    await act(async () => result.current.flush());
    expect(repository.saveCanvas).toHaveBeenCalledTimes(2);
    unmount();
  });
});
