import {
  WORKSPACE_EXPORT_TYPE,
  WORKSPACE_SCHEMA_VERSION,
  type WorkspaceExport,
} from "../domain/types";

import type { WorkspaceRepository } from "../storage/WorkspaceRepository";

export const serializeWorkspaceExport = (data: WorkspaceExport) =>
  JSON.stringify(data, null, data.project.protection.enabled ? 0 : 2);

export const parseWorkspaceExport = (value: string): WorkspaceExport => {
  let data: unknown;
  try {
    data = JSON.parse(value);
  } catch {
    throw new Error("El archivo no contiene JSON válido.");
  }
  const candidate = data as Partial<WorkspaceExport>;
  if (
    candidate.type !== WORKSPACE_EXPORT_TYPE ||
    candidate.schemaVersion !== WORKSPACE_SCHEMA_VERSION ||
    !candidate.project ||
    !Array.isArray(candidate.canvases) ||
    !Array.isArray(candidate.files)
  ) {
    throw new Error(
      "El archivo no es un proyecto .excalidraw-workspace válido.",
    );
  }
  return candidate as WorkspaceExport;
};

export const downloadProject = async (
  repository: WorkspaceRepository,
  projectId: string,
) => {
  const data = await repository.exportProject(projectId);
  const blob = new Blob([serializeWorkspaceExport(data)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${
    data.project.name.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "") ||
    "proyecto"
  }.excalidraw-workspace`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

export const readWorkspaceFile = async (file: File) =>
  parseWorkspaceExport(await file.text());
