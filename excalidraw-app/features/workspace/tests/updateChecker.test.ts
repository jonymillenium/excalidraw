import { checkForApplicationUpdate } from "../services/updateChecker";

const jsonResponse = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const noReleases = () => jsonResponse([]);

describe("application update checker", () => {
  it("stays local in development builds without an embedded commit", async () => {
    expect(
      await checkForApplicationUpdate({ currentCommit: "", version: "dev" }),
    ).toEqual({ state: "development", version: "dev" });
  });

  it("reports a current packaged build", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(noReleases())
      .mockResolvedValueOnce(jsonResponse({ sha: "same" }));

    expect(
      await checkForApplicationUpdate({
        currentCommit: "same",
        version: "1.2.2",
        fetcher,
      }),
    ).toEqual({ state: "current", version: "1.2.2", commit: "same" });
  });

  it("returns the downloadable arm64 DMG from a newer desktop release", async () => {
    const downloadUrl =
      "https://github.com/jonymillenium/excalidraw/releases/download/xcalidraw-desktop-v1.3.0/Xcalidraw-by-Kurk-1.3.0-arm64.dmg";
    const fetcher = vi.fn(async () =>
      jsonResponse([
        {
          tag_name: "xcalidraw-desktop-v1.3.0",
          html_url:
            "https://github.com/jonymillenium/excalidraw/releases/tag/xcalidraw-desktop-v1.3.0",
          assets: [
            {
              name: "Xcalidraw-by-Kurk-1.3.0-arm64.dmg",
              browser_download_url: downloadUrl,
              size: 141_000_000,
            },
          ],
        },
      ]),
    );

    expect(
      await checkForApplicationUpdate({
        currentCommit: "installed",
        version: "1.2.2",
        fetcher,
      }),
    ).toEqual({
      state: "available",
      version: "1.2.2",
      latestVersion: "1.3.0",
      url: "https://github.com/jonymillenium/excalidraw/releases/tag/xcalidraw-desktop-v1.3.0",
      downloadUrl,
      assetName: "Xcalidraw-by-Kurk-1.3.0-arm64.dmg",
      assetSize: 141_000_000,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("ignores releases without the expected desktop DMG", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse([
          {
            tag_name: "xcalidraw-desktop-v9.0.0",
            html_url: "https://example.com/release",
            assets: [{ name: "source.zip" }],
          },
        ]),
      )
      .mockResolvedValueOnce(jsonResponse({ sha: "same" }));

    expect(
      await checkForApplicationUpdate({
        currentCommit: "same",
        version: "1.2.2",
        fetcher,
      }),
    ).toEqual({ state: "current", version: "1.2.2", commit: "same" });
  });

  it("marks branch changes as pending until a DMG is published", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(noReleases())
      .mockResolvedValueOnce(jsonResponse({ sha: "latest" }))
      .mockResolvedValueOnce(jsonResponse({ ahead_by: 3 }));

    expect(
      await checkForApplicationUpdate({
        currentCommit: "installed",
        version: "1.2.2",
        fetcher,
      }),
    ).toEqual(
      expect.objectContaining({
        state: "pending",
        commits: 3,
        currentCommit: "installed",
        latestCommit: "latest",
      }),
    );
  });

  it("does not advertise an older remote branch as an update", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(noReleases())
      .mockResolvedValueOnce(jsonResponse({ sha: "older-remote" }))
      .mockResolvedValueOnce(
        jsonResponse({ status: "behind", ahead_by: 0, behind_by: 1 }),
      );

    expect(
      await checkForApplicationUpdate({
        currentCommit: "newer-installed",
        version: "1.2.2",
        fetcher,
      }),
    ).toEqual({
      state: "current",
      version: "1.2.2",
      commit: "newer-installed",
    });
  });

  it("turns GitHub failures into a non-blocking status", async () => {
    const fetcher = vi.fn(async () => jsonResponse({}, 403));

    expect(
      await checkForApplicationUpdate({
        currentCommit: "installed",
        fetcher,
      }),
    ).toEqual(
      expect.objectContaining({
        state: "error",
        message: "GitHub respondió 403.",
      }),
    );
  });
});
