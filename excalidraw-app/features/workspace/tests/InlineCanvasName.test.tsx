import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InlineCanvasName } from "../components/InlineCanvasName";

describe("InlineCanvasName", () => {
  it("enters inline edit mode on double click and saves with Enter", () => {
    const onSave = vi.fn();
    render(<InlineCanvasName name="Lienzo inicial" onSave={onSave} />);

    fireEvent.doubleClick(
      screen.getByRole("button", {
        name: "Editar nombre del lienzo Lienzo inicial",
      }),
    );

    const input = screen.getByRole("textbox", { name: "Nombre del lienzo" });
    expect(input).toHaveFocus();
    expect(input).toHaveValue("Lienzo inicial");
    expect(input).toHaveProperty("selectionStart", 0);
    expect(input).toHaveProperty("selectionEnd", "Lienzo inicial".length);

    fireEvent.change(input, { target: { value: "  Mapa de producto  " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledWith("Mapa de producto");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("cancels with Escape and saves when focus leaves the field", () => {
    const onSave = vi.fn();
    render(<InlineCanvasName name="Lienzo inicial" onSave={onSave} />);

    const nameButton = () =>
      screen.getByRole("button", {
        name: "Editar nombre del lienzo Lienzo inicial",
      });

    fireEvent.doubleClick(nameButton());
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "No guardar" },
    });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.doubleClick(nameButton());
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Nuevo nombre" } });
    fireEvent.blur(input);

    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledWith("Nuevo nombre");
  });
});
