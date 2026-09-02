import {
  CANVAS_COLOR_PROFILE_SLOTS,
  type CanvasColorProfile,
  type CanvasContrastLevel,
} from "./types";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export const DEFAULT_CANVAS_BACKGROUND_COLOR = "#ffffff";
export const DEFAULT_CANVAS_ELEMENT_COLOR = "#1e1e1e";

const normalizeHex = (color: string, fallback: string) =>
  HEX_COLOR.test(color) ? color.toLowerCase() : fallback;

export const normalizeCanvasColorProfiles = (
  profiles?: Array<CanvasColorProfile | null>,
): Array<CanvasColorProfile | null> =>
  Array.from({ length: CANVAS_COLOR_PROFILE_SLOTS }, (_, index) => {
    const profile = profiles?.[index];
    if (!profile) {
      return null;
    }
    return {
      ...profile,
      name: profile.name.trim() || `Perfil ${index + 1}`,
      backgroundColor: normalizeHex(
        profile.backgroundColor,
        DEFAULT_CANVAS_BACKGROUND_COLOR,
      ),
      elementColor: normalizeHex(
        profile.elementColor,
        DEFAULT_CANVAS_ELEMENT_COLOR,
      ),
    };
  });

const hexToRgb = (hex: string) => {
  const normalized = normalizeHex(hex, "#000000").slice(1);
  return [0, 2, 4].map((offset) =>
    Number.parseInt(normalized.slice(offset, offset + 2), 16),
  ) as [number, number, number];
};

const channelLuminance = (channel: number) => {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
};

export const relativeLuminance = (color: string) => {
  const [red, green, blue] = hexToRgb(color);
  return (
    0.2126 * channelLuminance(red) +
    0.7152 * channelLuminance(green) +
    0.0722 * channelLuminance(blue)
  );
};

export const contrastRatio = (first: string, second: string) => {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
};

const rgbToHex = (channels: [number, number, number]) =>
  `#${channels
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
    .join("")}`;

const blend = (from: string, to: string, amount: number) => {
  const source = hexToRgb(from);
  const target = hexToRgb(to);
  return rgbToHex(
    source.map(
      (channel, index) => channel + (target[index] - channel) * amount,
    ) as [number, number, number],
  );
};

export const contrastTargetForLevel = (level: CanvasContrastLevel) => {
  if (level === "soft") {
    return 3;
  }
  if (level === "high") {
    return 7;
  }
  return 4.5;
};

export const deriveElementColor = (
  backgroundColor: string,
  level: Exclude<CanvasContrastLevel, "custom">,
) => {
  const background = normalizeHex(backgroundColor, "#ffffff");
  const targetRatio = contrastTargetForLevel(level);
  const endpoint =
    contrastRatio(background, "#000000") >= contrastRatio(background, "#ffffff")
      ? "#000000"
      : "#ffffff";

  if (contrastRatio(background, endpoint) < targetRatio) {
    return endpoint;
  }

  let low = 0;
  let high = 1;
  for (let index = 0; index < 18; index++) {
    const middle = (low + high) / 2;
    if (
      contrastRatio(background, blend(background, endpoint, middle)) >=
      targetRatio
    ) {
      high = middle;
    } else {
      low = middle;
    }
  }
  return blend(background, endpoint, high);
};
