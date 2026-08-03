import { getDefaultAppState } from "../appState";

import { actionChangeViewBackgroundColor } from "./actionCanvas";

describe("canvas background actions", () => {
  it("treats a manually selected background as an exact display color", () => {
    const result = actionChangeViewBackgroundColor.perform(
      [],
      getDefaultAppState() as any,
      { viewBackgroundColor: "#313131" },
      null!,
    );

    expect(result).not.toBe(false);
    expect(
      result && "appState" in result ? result.appState : null,
    ).toMatchObject({
      viewBackgroundColor: "#313131",
      viewBackgroundColorMode: "exact",
    });
  });
});
