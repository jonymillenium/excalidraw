import type { BinaryFiles } from "@excalidraw/excalidraw/types";

import type {
  CanvasPayload,
  CanvasSummary,
  CreateProjectInput,
  LoadedCanvas,
  ProjectDetails,
  ProjectSummary,
  WorkspaceExport,
  WorkspaceSettings,
} from "../domain/types";

export class WorkspaceLockedError extends Error {
  constructor() {
    super("El proyecto está bloqueado.");
    this.name = "WorkspaceLockedError";
  }
}

export class WorkspacePasswordRequiredError extends Error {
  constructor() {
    super(
      "Introduce la contraseña del proyecto para completar la importación.",
    );
    this.name = "WorkspacePasswordRequiredError";
  }
}

export interface WorkspaceRepository {
  listProjects(): Promise<ProjectSummary[]>;
  getProject(id: string, key?: CryptoKey): Promise<ProjectDetails | null>;
  createProject(input: CreateProjectInput): Promise<{
    project: ProjectDetails;
    canvas: CanvasSummary;
    key?: CryptoKey;
  }>;
  updateProject(
    id: string,
    patch: { name?: string; description?: string },
    key?: CryptoKey,
  ): Promise<void>;
  duplicateProject(id: string, key?: CryptoKey): Promise<ProjectDetails>;
  reorderProjects(ids: string[]): Promise<void>;
  deleteProject(id: string): Promise<void>;

  listCanvases(projectId: string): Promise<CanvasSummary[]>;
  loadCanvas(
    projectId: string,
    canvasId: string,
    key?: CryptoKey,
  ): Promise<LoadedCanvas | null>;
  saveCanvas(
    projectId: string,
    canvasId: string,
    payload: CanvasPayload,
    files: BinaryFiles,
    key?: CryptoKey,
  ): Promise<void>;
  createCanvas(
    projectId: string,
    name?: string,
    key?: CryptoKey,
  ): Promise<CanvasSummary>;
  renameCanvas(
    projectId: string,
    canvasId: string,
    name: string,
  ): Promise<void>;
  duplicateCanvas(
    projectId: string,
    canvasId: string,
    key?: CryptoKey,
  ): Promise<CanvasSummary>;
  reorderCanvases(projectId: string, ids: string[]): Promise<void>;
  deleteCanvas(projectId: string, canvasId: string): Promise<void>;
  saveProjectThumbnail(
    projectId: string,
    canvasId: string,
    dataURL?: string,
  ): Promise<void>;
  getCanvasThumbnail(
    projectId: string,
    canvasId: string,
  ): Promise<string | undefined>;

  unlockProject(id: string, password: string): Promise<CryptoKey>;
  protectProject(id: string, password: string): Promise<CryptoKey>;
  changePassword(
    id: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<CryptoKey>;
  removeProtection(id: string, currentPassword: string): Promise<void>;

  exportProject(id: string): Promise<WorkspaceExport>;
  importProject(
    data: WorkspaceExport,
    password?: string,
  ): Promise<ProjectDetails>;

  getSettings(): Promise<WorkspaceSettings>;
  updateSettings(patch: Partial<WorkspaceSettings>): Promise<void>;
}
