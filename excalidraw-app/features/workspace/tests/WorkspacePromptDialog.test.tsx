import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";

import { useWorkspacePrompts } from "../components/WorkspacePromptDialog";

const CanvasPromptHarness = () => {
  const { askText, promptDialog } = useWorkspacePrompts();
  const [result, setResult] = useState("waiting");

  return (
    <>
      <button
        type="button"
        onClick={() => {
          void askText({
            title: "Crear nuevo lienzo",
            label: "Nombre del lienzo",
            confirmLabel: "Crear lienzo",
            secondaryLabel: "Crear como “Lienzo sin nombre”",
            secondaryValue: "Lienzo sin nombre",
          }).then((value) => setResult(value ?? "cancelled"));
        }}
      >
        Nuevo lienzo
      </button>
      <output>{result}</output>
      {promptDialog}
    </>
  );
};

describe("WorkspacePromptDialog", () => {
  it("offers an explicit unnamed canvas path", async () => {
    render(<CanvasPromptHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Nuevo lienzo" }));
    expect(
      screen.getByRole("dialog", { name: "Crear nuevo lienzo" }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Crear como “Lienzo sin nombre”",
      }),
    );

    expect(await screen.findByText("Lienzo sin nombre")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("returns the name entered by the user", async () => {
    render(<CanvasPromptHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Nuevo lienzo" }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "Nombre del lienzo" }),
      {
        target: { value: "Mapa de producto" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Crear lienzo" }));

    expect(await screen.findByText("Mapa de producto")).toBeInTheDocument();
  });
});
