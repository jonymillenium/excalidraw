import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CanvasColorProfilesDialog } from "../components/CanvasColorProfilesDialog";

describe("CanvasColorProfilesDialog", () => {
  it("applies native color input events before saving a black canvas", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <CanvasColorProfilesDialog
        profiles={[]}
        onSave={onSave}
        onDelete={vi.fn().mockResolvedValue(undefined)}
        onResetFactory={vi.fn().mockResolvedValue(undefined)}
        onClose={vi.fn()}
      />,
    );

    fireEvent.input(screen.getByLabelText("Color de fondo"), {
      target: { value: "#000000" },
    });

    expect(screen.getByText("#000000")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Guardar y aplicar" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0][1]).toMatchObject({
      backgroundColor: "#000000",
      elementColor: "#757575",
    });
  });

  it("restores the original Excalidraw style after confirmation", async () => {
    const onResetFactory = vi.fn().mockResolvedValue(undefined);
    render(
      <CanvasColorProfilesDialog
        profiles={[]}
        onSave={vi.fn().mockResolvedValue(undefined)}
        onDelete={vi.fn().mockResolvedValue(undefined)}
        onResetFactory={onResetFactory}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Restaurar apariencia original" }),
    );

    await waitFor(() => expect(onResetFactory).toHaveBeenCalledOnce());
    expect(screen.getByText("#ffffff")).toBeInTheDocument();
    expect(screen.getByText("#1e1e1e")).toBeInTheDocument();
  });
});
