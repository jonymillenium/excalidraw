import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WorkspaceDialog } from "../components/WorkspaceDialog";

const renderDialog = (onClose: () => void) => (
  <WorkspaceDialog title="Editar vista" onClose={onClose}>
    <label>
      Nombre
      <input aria-label="Nombre" />
    </label>
    <label>
      Descripción
      <textarea aria-label="Descripción" />
    </label>
  </WorkspaceDialog>
);

describe("WorkspaceDialog", () => {
  it("preserves the active field across parent rerenders", () => {
    const { rerender } = render(renderDialog(vi.fn()));
    const description = screen.getByRole("textbox", {
      name: "Descripción",
    });
    description.focus();

    rerender(renderDialog(vi.fn()));

    expect(description).toHaveFocus();
  });

  it("uses the latest close callback without reinstalling the focus trap", () => {
    const firstClose = vi.fn();
    const latestClose = vi.fn();
    const { rerender } = render(renderDialog(firstClose));
    rerender(renderDialog(latestClose));

    fireEvent.keyDown(document, { key: "Escape" });

    expect(firstClose).not.toHaveBeenCalled();
    expect(latestClose).toHaveBeenCalledOnce();
  });
});
