import { THEME } from "@excalidraw/common";

import { renderSnaps } from "./renderSnaps";

describe("distance snap rendering", () => {
  it("renders a pixel label for live spacing measurements", () => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d")!;
    const fillText = vi.spyOn(context, "fillText");

    renderSnaps(context, {
      snapLines: [
        {
          type: "distance",
          direction: "horizontal",
          points: [
            [10, 20],
            [34, 20],
          ],
          distance: 24,
        },
      ],
      theme: THEME.LIGHT,
      zenModeEnabled: false,
      zoom: { value: 1 },
      scrollX: 0,
      scrollY: 0,
    } as any);

    expect(fillText).toHaveBeenCalledWith(
      "24 px",
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("keeps fractional canvas distances readable", () => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d")!;
    const fillText = vi.spyOn(context, "fillText");

    renderSnaps(context, {
      snapLines: [
        {
          type: "distance",
          direction: "vertical",
          points: [
            [40, 10],
            [40, 22.25],
          ],
          distance: 12.25,
        },
      ],
      theme: THEME.DARK,
      zenModeEnabled: false,
      zoom: { value: 2 },
      scrollX: 0,
      scrollY: 0,
    } as any);

    expect(fillText).toHaveBeenCalledWith(
      "12.3 px",
      expect.any(Number),
      expect.any(Number),
    );
  });
});
