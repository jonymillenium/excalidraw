import { checkForApplicationUpdate } from "../services/updateChecker";

const jsonResponse = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("application update checker", () => {
  it("stays local in development builds without an embedded commit", async () => {
    expect(
      await checkForApplicationUpdate({ currentCommit: "", version: "dev" }),
    ).toEqual({ state: "development", version: "dev" });
  });

  it("reports a current packaged build", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ sha: "same" }));

    expect(
      await checkForApplicationUpdate({
        currentCommit: "same",
        version: "1.1.0",
        fetcher,
      }),
    ).toEqual({ state: "current", version: "1.1.0", commit: "same" });
  });

  it("counts published commits that are ahead", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ sha: "latest" }))
      .mockResolvedValueOnce(jsonResponse({ ahead_by: 3 }));

    expect(
      await checkForApplicationUpdate({
        currentCommit: "installed",
        version: "1.1.0",
        fetcher,
      }),
    ).toEqual(
      expect.objectContaining({
        state: "available",
        commits: 3,
        currentCommit: "installed",
        latestCommit: "latest",
      }),
    );
  });

  it("does not advertise an older remote branch as an update", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ sha: "older-remote" }))
      .mockResolvedValueOnce(
        jsonResponse({ status: "behind", ahead_by: 0, behind_by: 1 }),
      );

    expect(
      await checkForApplicationUpdate({
        currentCommit: "newer-installed",
        version: "1.1.0",
        fetcher,
      }),
    ).toEqual({
      state: "current",
      version: "1.1.0",
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
