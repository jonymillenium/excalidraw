import { describe, expect, it } from "vitest";

import { fitRect } from "../services/canvasThumbnail";

describe("project thumbnail fitting", () => {
  it("fits a wide scene without cropping", () => {
    expect(fitRect(1000, 250, 600, 300, 10)).toEqual({
      x: 10,
      y: 77.5,
      width: 580,
      height: 145,
    });
  });

  it("fits a tall scene without cropping", () => {
    expect(fitRect(200, 800, 600, 300)).toEqual({
      x: 262.5,
      y: 0,
      width: 75,
      height: 300,
    });
  });
});
