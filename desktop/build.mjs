import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const desktopDirectory = path.dirname(fileURLToPath(import.meta.url));
const builderCli = path.join(
  desktopDirectory,
  "node_modules/electron-builder/out/cli/cli.js",
);
const temporaryOutput = await mkdtemp(
  path.join(os.tmpdir(), "xcalidraw-desktop-"),
);

try {
  const result = spawnSync(
    process.execPath,
    [
      builderCli,
      "--mac",
      "dmg",
      `--config.directories.output=${temporaryOutput}`,
    ],
    { cwd: desktopDirectory, stdio: "inherit" },
  );
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
  } else {
    const outputDirectory = path.join(desktopDirectory, "dist");
    await mkdir(outputDirectory, { recursive: true });
    const artifacts = (await readdir(temporaryOutput)).filter(
      (name) => name.endsWith(".dmg") || name.endsWith(".dmg.blockmap"),
    );
    if (!artifacts.some((name) => name.endsWith(".dmg"))) {
      throw new Error("electron-builder no generó el instalador DMG esperado.");
    }
    await Promise.all(
      artifacts.map((name) =>
        copyFile(
          path.join(temporaryOutput, name),
          path.join(outputDirectory, name),
        ),
      ),
    );
    console.log(`Instalador listo en ${outputDirectory}`);
  }
} finally {
  await rm(temporaryOutput, { recursive: true, force: true });
}
