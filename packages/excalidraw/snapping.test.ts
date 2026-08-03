import type { Bounds } from "@excalidraw/common";

import { createDistanceSnapLines } from "./snapping";

describe("live distance snap lines", () => {
  it("measures the closest neighbour on every side in pixels", () => {
    const draggedBounds: Bounds = [100, 100, 150, 150];
    const referenceBounds: Bounds[] = [
      [20, 110, 70, 140],
      [180, 105, 230, 145],
      [110, 20, 140, 80],
      [105, 190, 145, 240],
      // Diagonal elements do not share an axis and must not create a guide.
      [0, 0, 10, 10],
    ];

    expect(createDistanceSnapLines(draggedBounds, referenceBounds)).toEqual([
      {
        type: "distance",
        direction: "horizontal",
        points: [
          [70, 125],
          [100, 125],
        ],
        distance: 30,
      },
      {
        type: "distance",
        direction: "horizontal",
        points: [
          [150, 125],
          [180, 125],
        ],
        distance: 30,
      },
      {
        type: "distance",
        direction: "vertical",
        points: [
          [125, 80],
          [125, 100],
        ],
        distance: 20,
      },
      {
        type: "distance",
        direction: "vertical",
        points: [
          [125, 150],
          [125, 190],
        ],
        distance: 40,
      },
    ]);
  });

  it("prefers the shortest distance and the widest overlap on ties", () => {
    const draggedBounds: Bounds = [100, 100, 150, 150];
    const referenceBounds: Bounds[] = [
      [0, 105, 80, 120],
      [10, 110, 90, 120],
      [20, 100, 90, 145],
    ];

    expect(createDistanceSnapLines(draggedBounds, referenceBounds)).toEqual([
      {
        type: "distance",
        direction: "horizontal",
        points: [
          [90, 122.5],
          [100, 122.5],
        ],
        distance: 10,
      },
    ]);
  });

  it("reports touching edges as zero pixels", () => {
    expect(
      createDistanceSnapLines([100, 100, 150, 150], [[50, 110, 100, 140]]),
    ).toMatchObject([
      {
        type: "distance",
        direction: "horizontal",
        distance: 0,
      },
    ]);
  });
});
