import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ZoomMenu } from "./ZoomMenu";

const renderMenu = () => {
  const actions = {
    onReset: vi.fn(),
    onZoomToFit: vi.fn(),
    onZoomToSelection: vi.fn(),
    onZoomToFitViewport: vi.fn(),
  };
  render(<ZoomMenu zoomValue={0.72} selectionAvailable={true} {...actions} />);
  return actions;
};

describe("ZoomMenu", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resets to 100% with a quick click and exposes fit actions", () => {
    const actions = renderMenu();

    fireEvent.click(screen.getByRole("button", { name: "Reset zoom" }));
    expect(actions.onReset).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "Zoom options" }));
    expect(screen.getByRole("menu", { name: "Zoom options" })).toBeVisible();

    fireEvent.click(
      screen.getByRole("menuitem", {
        name: /Zoom to fit all elements/,
      }),
    );
    expect(actions.onZoomToFit).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens the menu on a long press without resetting the zoom", () => {
    vi.useFakeTimers();
    const actions = renderMenu();
    const resetButton = screen.getByRole("button", { name: "Reset zoom" });

    fireEvent.pointerDown(resetButton, { button: 0 });
    act(() => vi.advanceTimersByTime(450));
    fireEvent.pointerUp(resetButton, { button: 0 });
    fireEvent.click(resetButton);

    expect(screen.getByRole("menu", { name: "Zoom options" })).toBeVisible();
    expect(actions.onReset).not.toHaveBeenCalled();
  });
});
