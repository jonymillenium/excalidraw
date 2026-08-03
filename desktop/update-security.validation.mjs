import assert from "node:assert/strict";
import test from "node:test";

import { resolveDesktopUpdateDownload } from "./update-security.mjs";

const validRequest = {
  downloadUrl:
    "https://github.com/jonymillenium/excalidraw/releases/download/xcalidraw-desktop-v1.3.0/Xcalidraw-1.3.0-arm64.dmg",
  assetName: "Xcalidraw-1.3.0-arm64.dmg",
};

test("accepts the versioned DMG from the authorized repository", () => {
  assert.deepEqual(resolveDesktopUpdateDownload(validRequest), validRequest);
});

test("rejects downloads from other hosts or repositories", () => {
  assert.throws(() =>
    resolveDesktopUpdateDownload({
      ...validRequest,
      downloadUrl:
        "https://example.com/jonymillenium/excalidraw/releases/download/v1/Xcalidraw-1.3.0-arm64.dmg",
    }),
  );
  assert.throws(() =>
    resolveDesktopUpdateDownload({
      ...validRequest,
      downloadUrl:
        "https://github.com/another/repository/releases/download/v1/Xcalidraw-1.3.0-arm64.dmg",
    }),
  );
});

test("rejects unexpected filenames and architectures", () => {
  assert.throws(() =>
    resolveDesktopUpdateDownload({
      ...validRequest,
      assetName: "../../Xcalidraw.dmg",
    }),
  );
  assert.throws(() =>
    resolveDesktopUpdateDownload({
      ...validRequest,
      assetName: "Xcalidraw-1.3.0-x64.dmg",
    }),
  );
});
