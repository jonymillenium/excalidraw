import { spawnSync } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const desktopDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryDirectory = path.resolve(desktopDirectory, "..");
const webApplicationDirectory = path.join(
  repositoryDirectory,
  "excalidraw-app",
);
const builderCli = path.join(
  desktopDirectory,
  "node_modules/electron-builder/out/cli/cli.js",
);
const viteCli = path.join(repositoryDirectory, "node_modules/vite/bin/vite.js");
const packageMetadata = JSON.parse(
  await readFile(path.join(desktopDirectory, "package.json"), "utf8"),
);
const revision = spawnSync("git", ["rev-parse", "HEAD"], {
  cwd: repositoryDirectory,
  encoding: "utf8",
});
if (revision.status !== 0 || !revision.stdout.trim()) {
  throw new Error(
    "No se pudo determinar el commit que identifica esta versión.",
  );
}
const worktree = spawnSync(
  "git",
  ["status", "--porcelain", "--untracked-files=normal"],
  { cwd: repositoryDirectory, encoding: "utf8" },
);
if (worktree.status !== 0 || worktree.stdout.trim()) {
  throw new Error(
    "Guarda los cambios en un commit antes de crear el instalador; el DMG debe corresponder a una versión identificable.",
  );
}

const webBuild = spawnSync(process.execPath, [viteCli, "build"], {
  cwd: webApplicationDirectory,
  stdio: "inherit",
  env: {
    ...process.env,
    VITE_APP_DISABLE_SENTRY: "true",
    VITE_APP_GIT_SHA: revision.stdout.trim(),
    VITE_APP_VERSION: packageMetadata.version,
    VITE_APP_UPDATE_REPOSITORY: "jonymillenium/excalidraw",
    VITE_APP_UPDATE_BRANCH: "feature/workspaces-projects-views-security",
  },
});
if (webBuild.status !== 0) {
  throw new Error("No se pudo compilar la aplicación web para macOS.");
}

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
      "zip",
      "--publish",
      "never",
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
      (name) =>
        name.endsWith(".dmg") ||
        name.endsWith(".blockmap") ||
        name.endsWith(".zip") ||
        name === "latest-mac.yml",
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
