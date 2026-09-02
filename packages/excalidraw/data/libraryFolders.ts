import type { LibraryItems } from "../types";

export const LIBRARY_FOLDERS_STORAGE_KEY = "excalidraw-library-folders:v1";

export const libraryFolderPathKey = (path: readonly string[]) =>
  path.join("\u001f");

export const isSameLibraryFolder = (
  first: readonly string[] | undefined,
  second: readonly string[],
) => libraryFolderPathKey(first ?? []) === libraryFolderPathKey(second);

export const normalizeLibraryFolderName = (name: string) =>
  name
    .trim()
    .replace(/[\\/]+/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 80);

export const loadCreatedLibraryFolders = (): string[][] => {
  try {
    const persisted = window.localStorage.getItem(LIBRARY_FOLDERS_STORAGE_KEY);
    const parsed: unknown = persisted ? JSON.parse(persisted) : [];
    return Array.isArray(parsed)
      ? parsed.filter(
          (path): path is string[] =>
            Array.isArray(path) &&
            path.length > 0 &&
            path.every((part) => typeof part === "string" && !!part.trim()),
        )
      : [];
  } catch {
    return [];
  }
};

export const saveCreatedLibraryFolders = (folders: readonly string[][]) => {
  try {
    window.localStorage.setItem(
      LIBRARY_FOLDERS_STORAGE_KEY,
      JSON.stringify(folders),
    );
  } catch {
    // Folder paths on items remain the portable source of truth.
  }
};

export const collectLibraryFolders = (
  libraryItems: LibraryItems,
  createdFolders = loadCreatedLibraryFolders(),
) => {
  const folders = new Map<string, string[]>();
  for (const path of createdFolders) {
    folders.set(libraryFolderPathKey(path), [...path]);
  }
  for (const item of libraryItems) {
    const path = item.folderPath ?? [];
    for (let depth = 1; depth <= path.length; depth++) {
      const prefix = path.slice(0, depth);
      folders.set(libraryFolderPathKey(prefix), [...prefix]);
    }
  }
  return [...folders.values()].sort((first, second) =>
    first.join(" / ").localeCompare(second.join(" / "), undefined, {
      sensitivity: "base",
    }),
  );
};
