import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync } from "node:zlib";

const repositoryDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const productionDirectory = path.join(
  repositoryDirectory,
  "packages/excalidraw/dist/prod",
);
const kibibyte = 1024;

const directoryEntries = await readdir(productionDirectory, {
  withFileTypes: true,
});
const localeEntries = await readdir(path.join(productionDirectory, "locales"), {
  withFileTypes: true,
});

const budgets = [
  {
    name: "core",
    limit: 340 * kibibyte,
    files: [path.join(productionDirectory, "index.js")],
  },
  {
    name: "locales",
    limit: 290 * kibibyte,
    files: localeEntries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
      .map((entry) => path.join(productionDirectory, "locales", entry.name)),
  },
  {
    name: "chunks",
    limit: 900 * kibibyte,
    files: directoryEntries
      .filter(
        (entry) =>
          entry.isFile() &&
          entry.name.startsWith("chunk-") &&
          entry.name.endsWith(".js"),
      )
      .map((entry) => path.join(productionDirectory, entry.name)),
  },
];

let failed = false;
for (const budget of budgets) {
  if (!budget.files.length) {
    throw new Error(`No files found for the ${budget.name} bundle budget.`);
  }
  const source = Buffer.concat(
    await Promise.all(budget.files.map((file) => readFile(file))),
  );
  const compressedBytes = brotliCompressSync(source).byteLength;
  const formattedSize = (compressedBytes / kibibyte).toFixed(1);
  const formattedLimit = (budget.limit / kibibyte).toFixed(0);
  console.log(`${budget.name}: ${formattedSize} KiB / ${formattedLimit} KiB`);
  if (compressedBytes > budget.limit) {
    failed = true;
  }
}

if (failed) {
  throw new Error("One or more Excalidraw bundle budgets were exceeded.");
}
