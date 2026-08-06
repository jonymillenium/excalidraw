import {
  CURATED_LIBRARIES,
  filterCuratedLibraries,
  normalizeCuratedLibraryItems,
} from "../services/curatedLibraries";

describe("curated workspace libraries", () => {
  it("covers the requested work categories with bundled files", () => {
    expect(new Set(CURATED_LIBRARIES.map((item) => item.category))).toEqual(
      new Set([
        "Marketing y negocio",
        "Web y producto",
        "Personas y storytelling",
        "Programación y sistemas",
        "Diagramas y procesos",
      ]),
    );
    expect(
      CURATED_LIBRARIES.every((item) => item.file.endsWith(".excalidrawlib")),
    ).toBe(true);
  });

  it("searches in Spanish keywords without accents", () => {
    expect(
      filterCuratedLibraries("programacion").map((item) => item.id),
    ).toContain("it-logos");
    expect(
      filterCuratedLibraries("camino comprador").map((item) => item.id),
    ).toEqual(["customer-journey"]);
  });

  it("gives legacy assets stable names and category folders", () => {
    const pack = CURATED_LIBRARIES.find((item) => item.id === "forms")!;
    expect(
      normalizeCuratedLibraryItems(pack, {
        library: [
          [{ type: "rectangle" }, { type: "text", text: "Formulario lead" }],
          [{ type: "ellipse" }],
        ],
      }),
    ).toEqual([
      expect.objectContaining({
        id: "kurk-forms-1",
        name: "Formulario lead",
        folderPath: ["Web y producto", "Formularios"],
      }),
      expect.objectContaining({
        id: "kurk-forms-2",
        name: "Formularios · Elemento 2",
      }),
    ]);
  });
});
