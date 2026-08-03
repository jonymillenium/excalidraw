import {
  WORKSPACE_BACKUP_TYPE,
  WORKSPACE_SCHEMA_VERSION,
  type WorkspaceBackup,
  type WorkspaceProfile,
} from "../domain/types";

import type { WorkspaceRepository } from "../storage/WorkspaceRepository";

const isWorkspaceProfile = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const profile = value as Partial<WorkspaceProfile>;
  return (
    typeof profile.id === "string" &&
    Boolean(profile.id) &&
    typeof profile.name === "string" &&
    Boolean(profile.name.trim()) &&
    typeof profile.createdAt === "number" &&
    typeof profile.updatedAt === "number"
  );
};

export const serializeWorkspaceBackup = (backup: WorkspaceBackup) =>
  JSON.stringify(backup, null, 2);

export const parseWorkspaceBackup = (value: string): WorkspaceBackup => {
  const parsed = JSON.parse(value) as Partial<WorkspaceBackup>;
  if (
    parsed.type !== WORKSPACE_BACKUP_TYPE ||
    parsed.schemaVersion !== WORKSPACE_SCHEMA_VERSION ||
    (parsed.scope !== "profile" && parsed.scope !== "all-profiles") ||
    !Array.isArray(parsed.profiles) ||
    !parsed.profiles.length ||
    parsed.profiles.some(
      (entry) =>
        !entry ||
        typeof entry !== "object" ||
        !isWorkspaceProfile(entry.profile) ||
        !Array.isArray(entry.projects),
    )
  ) {
    throw new Error("El archivo no es un backup completo válido.");
  }
  return parsed as WorkspaceBackup;
};

export const createWorkspaceBackup = async (
  entries: Array<{
    profile: WorkspaceProfile;
    repository: WorkspaceRepository;
  }>,
  options: { includeSettings: boolean; scope: WorkspaceBackup["scope"] },
): Promise<WorkspaceBackup> => {
  const profiles = await Promise.all(
    entries.map(async ({ profile, repository }) => {
      const projectSummaries = await repository.listProjects();
      const [settings, projects] = await Promise.all([
        options.includeSettings ? repository.getSettings() : undefined,
        Promise.all(
          projectSummaries.map((project) =>
            repository.exportProject(project.id),
          ),
        ),
      ]);
      return { profile, settings, projects };
    }),
  );
  return {
    type: WORKSPACE_BACKUP_TYPE,
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    exportedAt: Date.now(),
    scope: options.scope,
    includeSettings: options.includeSettings,
    profiles,
  };
};

export const downloadWorkspaceBackup = async (
  entries: Array<{
    profile: WorkspaceProfile;
    repository: WorkspaceRepository;
  }>,
  options: { includeSettings: boolean; scope: WorkspaceBackup["scope"] },
) => {
  const backup = await createWorkspaceBackup(entries, options);
  const blob = new Blob([serializeWorkspaceBackup(backup)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const date = new Date(backup.exportedAt).toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = `xcalidraw-backup-${date}.xcalidraw-backup`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

export const readWorkspaceBackup = async (file: File) =>
  parseWorkspaceBackup(await file.text());
