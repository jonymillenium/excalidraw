import { describe, expect, it } from "vitest";

import {
  contrastRatio,
  deriveElementColor,
  normalizeCanvasColorProfiles,
} from "../domain/canvasColors";

describe("canvas color profiles", () => {
  it("always exposes exactly six editable slots", () => {
    expect(normalizeCanvasColorProfiles()).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
  });

  it("derives foreground colors that meet each selected contrast", () => {
    const background = "#202124";
    expect(
      contrastRatio(background, deriveElementColor(background, "soft")),
    ).toBeGreaterThanOrEqual(2.98);
    expect(
      contrastRatio(background, deriveElementColor(background, "balanced")),
    ).toBeGreaterThanOrEqual(4.48);
    expect(
      contrastRatio(background, deriveElementColor(background, "high")),
    ).toBeGreaterThanOrEqual(6.98);
  });

  it("normalizes invalid persisted colors without deleting the profile", () => {
    const [profile] = normalizeCanvasColorProfiles([
      {
        id: "one",
        name: " ",
        backgroundColor: "invalid",
        elementColor: "also-invalid",
        contrastLevel: "custom",
        updatedAt: 1,
      },
    ]);
    expect(profile).toMatchObject({
      name: "Perfil 1",
      backgroundColor: "#ffffff",
      elementColor: "#1e1e1e",
    });
  });
});
