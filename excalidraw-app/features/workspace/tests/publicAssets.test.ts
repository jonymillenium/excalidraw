import { describe, expect, it, vi } from "vitest";

import {
  searchIconifyAssets,
  translateAssetSearch,
} from "../services/publicAssets";

describe("public asset search", () => {
  it("translates common Spanish product terms for global providers", () => {
    expect(translateAssetSearch("redes sociales")).toBe("social media");
    expect(translateAssetSearch("carrito ventas")).toBe("shopping cart sales");
  });

  it("maps Iconify names to safe SVG URLs", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ icons: ["mdi:chart-line", "lucide:users"] }),
    });
    const assets = await searchIconifyAssets(
      "gráfico",
      {},
      fetcher as unknown as typeof fetch,
    );

    expect(String(fetcher.mock.calls[0][0])).toBe(
      "https://api.iconify.design/search?query=chart&limit=96",
    );
    expect(assets).toEqual([
      expect.objectContaining({
        id: "mdi:chart-line",
        sourceUrl: "https://api.iconify.design/mdi/chart-line.svg",
      }),
      expect.objectContaining({ id: "lucide:users" }),
    ]);
  });

  it("limits Iconify searches to a selected style", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        icons: ["streamline-freehand:target"],
        collections: {
          "streamline-freehand": {
            name: "Freehand free icons",
            author: { name: "Streamline" },
            license: { spdx: "CC-BY-4.0" },
          },
        },
      }),
    });
    const assets = await searchIconifyAssets(
      "objetivo",
      { prefixes: ["streamline-freehand", "tabler"] },
      fetcher as unknown as typeof fetch,
    );

    expect(String(fetcher.mock.calls[0][0])).toContain(
      "prefixes=streamline-freehand%2Ctabler",
    );
    expect(assets[0]).toEqual(
      expect.objectContaining({
        author: "Streamline",
        collection: "Freehand free icons",
        license: "CC-BY-4.0",
      }),
    );
  });
});
