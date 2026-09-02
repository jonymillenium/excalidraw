import type { ExcalidrawElement, FileId } from "@excalidraw/element/types";
import type { AppState, BinaryFileData } from "@excalidraw/excalidraw/types";

export const WORKSPACE_SCHEMA_VERSION = 1 as const;
export const WORKSPACE_EXPORT_TYPE = "excalidraw-workspace" as const;
export const WORKSPACE_BACKUP_TYPE = "excalidraw-workspace-backup" as const;
export const PRECISION_SNAPPING_VERSION = 1 as const;

export type WorkspaceSchemaVersion = typeof WORKSPACE_SCHEMA_VERSION;

export type SavedView = {
  id: string;
  canvasId: string;
  name: string;
  description?: string;
  /** Hierarchical location inside the views sidebar. Empty means root. */
  folderPath?: string[];
  order: number;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  transitionDurationMs: number;
  createdAt: number;
  updatedAt: number;
  thumbnail?: string;
};

export type CanvasContrastLevel = "soft" | "balanced" | "high" | "custom";

export type CanvasColorProfile = {
  id: string;
  name: string;
  backgroundColor: string;
  elementColor: string;
  contrastLevel: CanvasContrastLevel;
  updatedAt: number;
};

export const CANVAS_COLOR_PROFILE_SLOTS = 6 as const;

export type CanvasPayload = {
  elements: readonly ExcalidrawElement[];
  appState: Partial<AppState>;
  fileIds: FileId[];
  views: SavedView[];
  /** Explicit list keeps empty folders and subfolders persistent. */
  viewFolders?: string[][];
  /** Six user-editable color presets. Null entries are intentionally empty. */
  colorProfiles?: Array<CanvasColorProfile | null>;
  editorFeatures?: {
    precisionSnappingVersion: typeof PRECISION_SNAPPING_VERSION;
  };
};

export type PlainEnvelope<T = unknown> = {
  encrypted: false;
  data: T;
  schemaVersion: WorkspaceSchemaVersion;
};

export type EncryptedEnvelope = {
  encrypted: true;
  algorithm: "AES-GCM";
  iv: string;
  ciphertext: string;
  schemaVersion: WorkspaceSchemaVersion;
};

export type DataEnvelope<T> = PlainEnvelope<T> | EncryptedEnvelope;

export type ProjectProtection =
  | { enabled: false }
  | {
      enabled: true;
      version: 1;
      kdf: "PBKDF2";
      hash: "SHA-256";
      iterations: number;
      salt: string;
      verifier: EncryptedEnvelope;
    };

export type ProfileProtection =
  | { enabled: false }
  | {
      enabled: true;
      version: 1;
      kdf: "PBKDF2";
      hash: "SHA-256";
      iterations: number;
      salt: string;
      verifier: EncryptedEnvelope;
    };

export type WorkspaceAccentStyle = "racing" | "contour" | "pinstripe";
export type WorkspaceAccentIntensity = "subtle" | "vivid";

export type WorkspaceAppearance = {
  accentColor: string;
  accentStyle: WorkspaceAccentStyle;
  accentIntensity: WorkspaceAccentIntensity;
};

export const DEFAULT_WORKSPACE_APPEARANCE: WorkspaceAppearance = {
  accentColor: "#ffd400",
  accentStyle: "contour",
  accentIntensity: "vivid",
};

export type ProjectPrivateData = {
  description?: string;
};

export type ProjectRecord = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  lastOpenedAt?: number;
  order: number;
  protection: ProjectProtection;
  privateData: DataEnvelope<ProjectPrivateData>;
  schemaVersion: WorkspaceSchemaVersion;
};

export type CanvasRecord = {
  id: string;
  projectId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  order: number;
  payload: DataEnvelope<CanvasPayload>;
  schemaVersion: WorkspaceSchemaVersion;
};

export type WorkspaceFileRecord = {
  id: FileId;
  projectId: string;
  canvasId: string;
  updatedAt: number;
  fingerprint: string;
  data: DataEnvelope<BinaryFileData>;
  schemaVersion: WorkspaceSchemaVersion;
};

export type WorkspaceThumbnailRecord = {
  id: string;
  projectId: string;
  canvasId: string;
  dataURL: string;
  updatedAt: number;
};

export type ProjectSummary = Pick<
  ProjectRecord,
  | "id"
  | "name"
  | "createdAt"
  | "updatedAt"
  | "lastOpenedAt"
  | "order"
  | "protection"
> & {
  canvasCount: number;
  thumbnail?: string;
};

export type ProjectDetails = ProjectSummary & ProjectPrivateData;

export type CanvasSummary = Pick<
  CanvasRecord,
  "id" | "projectId" | "name" | "createdAt" | "updatedAt" | "order"
>;

export type LoadedCanvas = CanvasSummary & {
  payload: CanvasPayload;
  files: Record<FileId, BinaryFileData>;
};

export type CreateProjectInput = {
  name: string;
  description?: string;
  password?: string;
};

export type WorkspaceSettings = {
  lastProjectId?: string;
  lastCanvasId?: string;
  reopenLastCanvas: boolean;
  legacyMigrationCompleted: boolean;
  schemaVersion: WorkspaceSchemaVersion;
  ai?: WorkspaceAISettings;
};

export type WorkspaceAIUsageDay = {
  date: string;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
};

export type WorkspaceAISettings = {
  provider: "openrouter";
  model: string;
  apiKey: EncryptedEnvelope;
  apiKeyHint: string;
  updatedAt: number;
  usage: WorkspaceAIUsageDay[];
};

export type WorkspaceProfile = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  protection: ProfileProtection;
  appearance: WorkspaceAppearance;
};

export type WorkspaceExport = {
  type: typeof WORKSPACE_EXPORT_TYPE;
  schemaVersion: WorkspaceSchemaVersion;
  exportedAt: number;
  project: ProjectRecord;
  canvases: CanvasRecord[];
  files: WorkspaceFileRecord[];
};

export type WorkspaceBackup = {
  type: typeof WORKSPACE_BACKUP_TYPE;
  schemaVersion: WorkspaceSchemaVersion;
  exportedAt: number;
  scope: "profile" | "all-profiles";
  includeSettings: boolean;
  profiles: Array<{
    profile: WorkspaceProfile;
    settings?: WorkspaceSettings;
    projects: WorkspaceExport[];
  }>;
};

export type WorkspaceAIProvider = {
  generateElements(input: {
    prompt: string;
    canvasContext?: unknown;
  }): Promise<{
    elements: unknown[];
    files?: unknown;
  }>;
};

export const createEmptyCanvasPayload = (): CanvasPayload => ({
  elements: [],
  appState: {
    viewBackgroundColor: "#ffffff",
    viewBackgroundColorMode: "theme",
    scrollX: 0,
    scrollY: 0,
    objectsSnapModeEnabled: true,
  },
  fileIds: [],
  views: [],
  viewFolders: [],
  colorProfiles: Array.from({ length: CANVAS_COLOR_PROFILE_SLOTS }, () => null),
  editorFeatures: {
    precisionSnappingVersion: PRECISION_SNAPPING_VERSION,
  },
});

export const createPlainEnvelope = <T>(data: T): PlainEnvelope<T> => ({
  encrypted: false,
  data,
  schemaVersion: WORKSPACE_SCHEMA_VERSION,
});
