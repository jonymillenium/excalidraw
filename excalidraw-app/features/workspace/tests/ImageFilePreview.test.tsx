import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ImageFilePreview } from "../components/ImageFilePreview";

describe("ImageFilePreview", () => {
  const createObjectURL = vi.fn(() => "blob:local-preview");
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("previews a local image and opens a zoomable detail viewer", () => {
    render(
      <ImageFilePreview
        file={new File(["preview"], "mapa.png", { type: "image/png" })}
        onRemove={vi.fn()}
      />,
    );

    const previewImage = screen.getByAltText("Vista previa de mapa.png");
    Object.defineProperties(previewImage, {
      naturalWidth: { configurable: true, value: 1920 },
      naturalHeight: { configurable: true, value: 1080 },
    });
    fireEvent.load(previewImage);

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(screen.getByText(/1920 × 1080 px/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ampliar" }));
    expect(
      screen.getByRole("dialog", {
        name: "Vista detallada de mapa.png",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Ajustado")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Acercar imagen" }));
    expect(screen.getByText("125%")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "100%" }));
    expect(screen.getByRole("status")).toHaveTextContent("100%");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("releases its local URL and can remove the selection", () => {
    const onRemove = vi.fn();
    const { unmount } = render(
      <ImageFilePreview
        file={new File(["preview"], "foto.webp", { type: "image/webp" })}
        onRemove={onRemove}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Quitar" }));
    expect(onRemove).toHaveBeenCalledOnce();

    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:local-preview");
  });
});
