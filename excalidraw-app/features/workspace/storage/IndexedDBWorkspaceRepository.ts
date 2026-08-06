import { clearAppStateForLocalStorage } from "@excalidraw/excalidraw/appState";

import type { FileId } from "@excalidraw/element/types";
import type { BinaryFileData, BinaryFiles } from "@excalidraw/excalidraw/types";

import {
  createProjectProtection,
  decryptJson,
  encryptJson,
  unlockProjectKey,
} from "../crypto/projectCrypto";
import {
  WORKSPACE_EXPORT_TYPE,
  WORKSPACE_SCHEMA_VERSION,
  createEmptyCanvasPayload,
  createPlainEnvelope,
  type CanvasPayload,
  type CanvasRecord,
  type CanvasSummary,
  type CreateProjectInput,
  type DataEnvelope,
  type ProjectPrivateData,
  type ProjectRecord,
  type ProjectSummary,
  type WorkspaceExport,
  type WorkspaceFileRecord,
  type WorkspaceSettings,
  type WorkspaceThumbnailRecord,
} from "../domain/types";

import {
  WorkspaceLockedError,
  WorkspacePasswordRequiredError,
  type WorkspaceRepository,
} from "./WorkspaceRepository";

export const WORKSPACE_DB_NAME = "excalidraw-workspace";
export const WORKSPACE_DB_VERSION = 1;

const STORES = {
  projects: "workspace-projects",
  canvases: "workspace-canvases",
  files: "workspace-files",
  settings: "workspace-settings",
  thumbnails: "workspace-thumbnails",
} as const;

const DEFAULT_SETTINGS: WorkspaceSettings = {
  reopenLastCanvas: true,
  legacyMigrationCompleted: false,
  schemaVersion: WORKSPACE_SCHEMA_VERSION,
};

const requestToPromise = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const transactionToPromise = (transaction: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });

const openDatabase = (databaseName: string) =>
  new Promise<IDBDatabase>((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error("IndexedDB no está disponible en este navegador."));
      return;
    }
    const request = indexedDB.open(databaseName, WORKSPACE_DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(
        new Error(
          "No se pudo actualizar el almacenamiento. Cierra otras pestañas y vuelve a intentarlo.",
        ),
      );
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.projects)) {
        db.createObjectStore(STORES.projects, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.canvases)) {
        const store = db.createObjectStore(STORES.canvases, {
          keyPath: "id",
        });
        store.createIndex("projectId", "projectId", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.files)) {
        const store = db.createObjectStore(STORES.files, {
          keyPath: ["projectId", "canvasId", "id"],
        });
        store.createIndex("projectId", "projectId", { unique: false });
        store.createIndex("canvasId", ["projectId", "canvasId"], {
          unique: false,
        });
      }
      if (!db.objectStoreNames.contains(STORES.settings)) {
        db.createObjectStore(STORES.settings, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(STORES.thumbnails)) {
        db.createObjectStore(STORES.thumbnails, { keyPath: "id" });
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
  });

const createId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const normalizedName = (name: string, kind: string) => {
  const value = name.trim();
  if (!value) {
    throw new Error(`El nombre del ${kind} no puede estar vacío.`);
  }
  return value;
};

const fingerprintFile = (file: BinaryFileData) =>
  `${file.mimeType}:${file.created}:${file.dataURL.length}:${file.dataURL.slice(
    -24,
  )}`;

const toCanvasSummary = (record: CanvasRecord): CanvasSummary => ({
  id: record.id,
  projectId: record.projectId,
  name: record.name,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
  order: record.order,
});

const sortByOrder = <T extends { order: number }>(records: T[]) =>
  records.sort((a, b) => a.order - b.order);

const getEnvelopeData = async <T>(
  projectId: string,
  recordType: string,
  envelope: DataEnvelope<T>,
  key?: CryptoKey,
) => {
  if (!envelope.encrypted) {
    return envelope.data;
  }
  if (!key) {
    throw new WorkspaceLockedError();
  }
  return decryptJson<T>(key, envelope, { projectId, recordType });
};

const createEnvelope = async <T>(
  project: ProjectRecord,
  recordType: string,
  data: T,
  key?: CryptoKey,
): Promise<DataEnvelope<T>> => {
  if (!project.protection.enabled) {
    return createPlainEnvelope(data);
  }
  if (!key) {
    throw new WorkspaceLockedError();
  }
  return encryptJson(key, data, {
    projectId: project.id,
    recordType,
  });
};

const normalizeStorageError = (error: unknown): Error => {
  if (error instanceof DOMException && error.name === "QuotaExceededError") {
    return new Error(
      "No hay espacio local suficiente. Exporta un respaldo de emergencia antes de continuar.",
    );
  }
  return error instanceof Error
    ? error
    : new Error("No se pudieron guardar los cambios en IndexedDB.");
};

export class IndexedDBWorkspaceRepository implements WorkspaceRepository {
  private readonly database: Promise<IDBDatabase>;

  constructor(databaseName = WORKSPACE_DB_NAME) {
    this.database = openDatabase(databaseName);
  }

  async close() {
    (await this.database).close();
  }

  private async getProjectRecord(id: string) {
    const db = await this.database;
    const transaction = db.transaction(STORES.projects, "readonly");
    return requestToPromise<ProjectRecord | undefined>(
      transaction.objectStore(STORES.projects).get(id),
    );
  }

  private async getCanvasRecords(projectId: string) {
    const db = await this.database;
    const transaction = db.transaction(STORES.canvases, "readonly");
    const records = await requestToPromise<CanvasRecord[]>(
      transaction
        .objectStore(STORES.canvases)
        .index("projectId")
        .getAll(projectId),
    );
    return sortByOrder(records);
  }

  private async getFileRecords(projectId: string, canvasId?: string) {
    const db = await this.database;
    const transaction = db.transaction(STORES.files, "readonly");
    const store = transaction.objectStore(STORES.files);
    return requestToPromise<WorkspaceFileRecord[]>(
      canvasId
        ? store.index("canvasId").getAll([projectId, canvasId])
        : store.index("projectId").getAll(projectId),
    );
  }

  private async getThumbnailRecords(projectId: string) {
    const db = await this.database;
    const transaction = db.transaction(STORES.thumbnails, "readonly");
    const records = await requestToPromise<WorkspaceThumbnailRecord[]>(
      transaction.objectStore(STORES.thumbnails).getAll(),
    );
    return records.filter((thumbnail) => thumbnail.projectId === projectId);
  }

  private async getAllProjectData(projectId: string) {
    const project = await this.getProjectRecord(projectId);
    if (!project) {
      throw new Error("El proyecto no existe.");
    }
    const [canvases, files] = await Promise.all([
      this.getCanvasRecords(projectId),
      this.getFileRecords(projectId),
    ]);
    return { project, canvases, files };
  }

  private async writeProjectData(data: {
    project: ProjectRecord;
    canvases: CanvasRecord[];
    files: WorkspaceFileRecord[];
  }) {
    try {
      const db = await this.database;
      const transaction = db.transaction(
        [STORES.projects, STORES.canvases, STORES.files],
        "readwrite",
      );
      transaction.objectStore(STORES.projects).put(data.project);
      const canvasesStore = transaction.objectStore(STORES.canvases);
      data.canvases.forEach((canvas) => canvasesStore.put(canvas));
      const filesStore = transaction.objectStore(STORES.files);
      data.files.forEach((file) => filesStore.put(file));
      await transactionToPromise(transaction);
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  async listProjects(): Promise<ProjectSummary[]> {
    const db = await this.database;
    const transaction = db.transaction(
      [STORES.projects, STORES.canvases, STORES.thumbnails],
      "readonly",
    );
    const [projects, canvases, thumbnails] = await Promise.all([
      requestToPromise<ProjectRecord[]>(
        transaction.objectStore(STORES.projects).getAll(),
      ),
      requestToPromise<CanvasRecord[]>(
        transaction.objectStore(STORES.canvases).getAll(),
      ),
      requestToPromise<WorkspaceThumbnailRecord[]>(
        transaction.objectStore(STORES.thumbnails).getAll(),
      ),
    ]);
    const canvasCount = new Map<string, number>();
    canvases.forEach((canvas) =>
      canvasCount.set(
        canvas.projectId,
        (canvasCount.get(canvas.projectId) ?? 0) + 1,
      ),
    );
    const thumbnailsByProject = new Map<string, WorkspaceThumbnailRecord>();
    thumbnails.forEach((thumbnail) => {
      const current = thumbnailsByProject.get(thumbnail.projectId);
      if (!current || current.updatedAt < thumbnail.updatedAt) {
        thumbnailsByProject.set(thumbnail.projectId, thumbnail);
      }
    });
    return sortByOrder(
      projects.map((project) => ({
        id: project.id,
        name: project.name,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        lastOpenedAt: project.lastOpenedAt,
        order: project.order,
        protection: project.protection,
        canvasCount: canvasCount.get(project.id) ?? 0,
        thumbnail: project.protection.enabled
          ? undefined
          : thumbnailsByProject.get(project.id)?.dataURL,
      })),
    );
  }

  async getProject(id: string, key?: CryptoKey) {
    const project = await this.getProjectRecord(id);
    if (!project) {
      return null;
    }
    const privateData = await getEnvelopeData<ProjectPrivateData>(
      id,
      "project-private",
      project.privateData,
      key,
    );
    const canvasCount = (await this.getCanvasRecords(id)).length;
    return {
      id: project.id,
      name: project.name,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      lastOpenedAt: project.lastOpenedAt,
      order: project.order,
      protection: project.protection,
      canvasCount,
      ...privateData,
    };
  }

  async createProject(input: CreateProjectInput) {
    const name = normalizedName(input.name, "proyecto");
    const projects = await this.listProjects();
    const projectId = createId();
    const canvasId = createId();
    const now = Date.now();
    let key: CryptoKey | undefined;
    let protection: ProjectRecord["protection"] = { enabled: false };
    if (input.password) {
      const created = await createProjectProtection(projectId, input.password);
      protection = created.protection;
      key = created.key;
    }
    const baseProject: ProjectRecord = {
      id: projectId,
      name,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
      order: projects.length,
      protection,
      privateData: createPlainEnvelope({}),
      schemaVersion: WORKSPACE_SCHEMA_VERSION,
    };
    baseProject.privateData = await createEnvelope(
      baseProject,
      "project-private",
      { description: input.description?.trim() || undefined },
      key,
    );
    const canvas: CanvasRecord = {
      id: canvasId,
      projectId,
      name: "Lienzo 1",
      createdAt: now,
      updatedAt: now,
      order: 0,
      payload: await createEnvelope(
        baseProject,
        `canvas:${canvasId}`,
        createEmptyCanvasPayload(),
        key,
      ),
      schemaVersion: WORKSPACE_SCHEMA_VERSION,
    };
    await this.writeProjectData({
      project: baseProject,
      canvases: [canvas],
      files: [],
    });
    return {
      project: (await this.getProject(projectId, key))!,
      canvas: toCanvasSummary(canvas),
      key,
    };
  }

  async updateProject(
    id: string,
    patch: { name?: string; description?: string },
    key?: CryptoKey,
  ) {
    const project = await this.getProjectRecord(id);
    if (!project) {
      throw new Error("El proyecto no existe.");
    }
    if (patch.name !== undefined) {
      project.name = normalizedName(patch.name, "proyecto");
    }
    if (patch.description !== undefined) {
      project.privateData = await createEnvelope(
        project,
        "project-private",
        { description: patch.description.trim() || undefined },
        key,
      );
    }
    project.updatedAt = Date.now();
    const db = await this.database;
    const transaction = db.transaction(STORES.projects, "readwrite");
    transaction.objectStore(STORES.projects).put(project);
    await transactionToPromise(transaction);
  }

  async duplicateProject(id: string, key?: CryptoKey) {
    const source = await this.getAllProjectData(id);
    if (source.project.protection.enabled && !key) {
      throw new WorkspaceLockedError();
    }
    const newProjectId = createId();
    const now = Date.now();
    const projects = await this.listProjects();
    const privateData = await getEnvelopeData<ProjectPrivateData>(
      id,
      "project-private",
      source.project.privateData,
      key,
    );
    const project: ProjectRecord = {
      ...source.project,
      id: newProjectId,
      name: `${source.project.name} (copia)`,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
      order: projects.length,
      privateData: createPlainEnvelope({}),
      protection: source.project.protection.enabled
        ? {
            ...source.project.protection,
            verifier: await encryptJson(
              key!,
              {
                type: "workspace-project-verifier",
                version: 1,
                projectId: newProjectId,
              },
              { projectId: newProjectId, recordType: "verifier" },
            ),
          }
        : { enabled: false },
    };
    project.privateData = await createEnvelope(
      project,
      "project-private",
      privateData,
      key,
    );
    const canvasIdMap = new Map<string, string>();
    const canvases: CanvasRecord[] = [];
    for (const sourceCanvas of source.canvases) {
      const newCanvasId = createId();
      canvasIdMap.set(sourceCanvas.id, newCanvasId);
      const payload = await getEnvelopeData<CanvasPayload>(
        id,
        `canvas:${sourceCanvas.id}`,
        sourceCanvas.payload,
        key,
      );
      const nextPayload = {
        ...payload,
        views: payload.views.map((view) => ({
          ...view,
          id: createId(),
          canvasId: newCanvasId,
        })),
      };
      canvases.push({
        ...sourceCanvas,
        id: newCanvasId,
        projectId: newProjectId,
        createdAt: now,
        updatedAt: now,
        payload: await createEnvelope(
          project,
          `canvas:${newCanvasId}`,
          nextPayload,
          key,
        ),
      });
    }
    const files: WorkspaceFileRecord[] = [];
    for (const sourceFile of source.files) {
      const canvasId = canvasIdMap.get(sourceFile.canvasId)!;
      const data = await getEnvelopeData<BinaryFileData>(
        id,
        `file:${sourceFile.canvasId}:${sourceFile.id}`,
        sourceFile.data,
        key,
      );
      files.push({
        ...sourceFile,
        projectId: newProjectId,
        canvasId,
        updatedAt: now,
        data: await createEnvelope(
          project,
          `file:${canvasId}:${sourceFile.id}`,
          data,
          key,
        ),
      });
    }
    await this.writeProjectData({ project, canvases, files });
    return (await this.getProject(newProjectId, key))!;
  }

  async reorderProjects(ids: string[]) {
    const db = await this.database;
    const records = await Promise.all(
      ids.map((id) => this.getProjectRecord(id)),
    );
    const transaction = db.transaction(STORES.projects, "readwrite");
    records.forEach((record, order) => {
      if (record) {
        transaction.objectStore(STORES.projects).put({ ...record, order });
      }
    });
    await transactionToPromise(transaction);
  }

  async deleteProject(id: string) {
    const { canvases, files } = await this.getAllProjectData(id);
    const thumbnails = await this.getThumbnailRecords(id);
    const db = await this.database;
    const transaction = db.transaction(
      [STORES.projects, STORES.canvases, STORES.files, STORES.thumbnails],
      "readwrite",
    );
    transaction.objectStore(STORES.projects).delete(id);
    canvases.forEach((canvas) =>
      transaction.objectStore(STORES.canvases).delete(canvas.id),
    );
    files.forEach((file) =>
      transaction
        .objectStore(STORES.files)
        .delete([file.projectId, file.canvasId, file.id]),
    );
    thumbnails.forEach((thumbnail) =>
      transaction.objectStore(STORES.thumbnails).delete(thumbnail.id),
    );
    await transactionToPromise(transaction);
  }

  async listCanvases(projectId: string) {
    return (await this.getCanvasRecords(projectId)).map(toCanvasSummary);
  }

  async loadCanvas(projectId: string, canvasId: string, key?: CryptoKey) {
    const db = await this.database;
    const transaction = db.transaction(STORES.canvases, "readonly");
    const canvas = await requestToPromise<CanvasRecord | undefined>(
      transaction.objectStore(STORES.canvases).get(canvasId),
    );
    if (!canvas || canvas.projectId !== projectId) {
      return null;
    }
    const payload = await getEnvelopeData<CanvasPayload>(
      projectId,
      `canvas:${canvasId}`,
      canvas.payload,
      key,
    );
    const fileRecords = await this.getFileRecords(projectId, canvasId);
    const files = {} as Record<FileId, BinaryFileData>;
    for (const file of fileRecords) {
      files[file.id] = await getEnvelopeData<BinaryFileData>(
        projectId,
        `file:${canvasId}:${file.id}`,
        file.data,
        key,
      );
    }
    return { ...toCanvasSummary(canvas), payload, files };
  }

  async saveCanvas(
    projectId: string,
    canvasId: string,
    payload: CanvasPayload,
    files: BinaryFiles,
    key?: CryptoKey,
  ) {
    try {
      const project = await this.getProjectRecord(projectId);
      if (!project) {
        throw new Error("El proyecto no existe.");
      }
      const db = await this.database;
      const readTransaction = db.transaction(STORES.canvases, "readonly");
      const canvas = await requestToPromise<CanvasRecord | undefined>(
        readTransaction.objectStore(STORES.canvases).get(canvasId),
      );
      if (!canvas || canvas.projectId !== projectId) {
        throw new Error("El lienzo ya no existe.");
      }
      const now = Date.now();
      const currentFileRecords = await this.getFileRecords(projectId, canvasId);
      const currentFiles = new Map(
        currentFileRecords.map((record) => [record.id, record]),
      );
      const fileIds = Object.keys(files) as FileId[];
      const normalizedPayload: CanvasPayload = {
        ...payload,
        elements: payload.elements.filter((element) => !element.isDeleted),
        appState: clearAppStateForLocalStorage(payload.appState),
        fileIds,
      };
      canvas.payload = await createEnvelope(
        project,
        `canvas:${canvasId}`,
        normalizedPayload,
        key,
      );
      canvas.updatedAt = now;
      project.updatedAt = now;
      const changedFiles: WorkspaceFileRecord[] = [];
      for (const id of fileIds) {
        const file = files[id];
        const fingerprint = fingerprintFile(file);
        if (currentFiles.get(id)?.fingerprint === fingerprint) {
          continue;
        }
        changedFiles.push({
          id,
          projectId,
          canvasId,
          updatedAt: now,
          fingerprint,
          data: await createEnvelope(
            project,
            `file:${canvasId}:${id}`,
            file,
            key,
          ),
          schemaVersion: WORKSPACE_SCHEMA_VERSION,
        });
      }
      const validFileIds = new Set(fileIds);
      const removedFiles = currentFileRecords.filter(
        (record) => !validFileIds.has(record.id),
      );
      const writeTransaction = db.transaction(
        [STORES.projects, STORES.canvases, STORES.files],
        "readwrite",
      );
      writeTransaction.objectStore(STORES.projects).put(project);
      writeTransaction.objectStore(STORES.canvases).put(canvas);
      changedFiles.forEach((file) =>
        writeTransaction.objectStore(STORES.files).put(file),
      );
      removedFiles.forEach((file) =>
        writeTransaction
          .objectStore(STORES.files)
          .delete([projectId, canvasId, file.id]),
      );
      await transactionToPromise(writeTransaction);
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  async createCanvas(projectId: string, name?: string, key?: CryptoKey) {
    const project = await this.getProjectRecord(projectId);
    if (!project) {
      throw new Error("El proyecto no existe.");
    }
    const canvases = await this.getCanvasRecords(projectId);
    const id = createId();
    const now = Date.now();
    const canvas: CanvasRecord = {
      id,
      projectId,
      name: normalizedName(name ?? `Lienzo ${canvases.length + 1}`, "lienzo"),
      createdAt: now,
      updatedAt: now,
      order: canvases.length,
      payload: await createEnvelope(
        project,
        `canvas:${id}`,
        createEmptyCanvasPayload(),
        key,
      ),
      schemaVersion: WORKSPACE_SCHEMA_VERSION,
    };
    project.updatedAt = now;
    await this.writeProjectData({ project, canvases: [canvas], files: [] });
    return toCanvasSummary(canvas);
  }

  async renameCanvas(projectId: string, canvasId: string, name: string) {
    const db = await this.database;
    const transaction = db.transaction(STORES.canvases, "readwrite");
    const store = transaction.objectStore(STORES.canvases);
    const canvas = await requestToPromise<CanvasRecord | undefined>(
      store.get(canvasId),
    );
    if (!canvas || canvas.projectId !== projectId) {
      transaction.abort();
      throw new Error("El lienzo no existe.");
    }
    canvas.name = normalizedName(name, "lienzo");
    canvas.updatedAt = Date.now();
    store.put(canvas);
    await transactionToPromise(transaction);
  }

  async duplicateCanvas(projectId: string, canvasId: string, key?: CryptoKey) {
    const project = await this.getProjectRecord(projectId);
    const loaded = await this.loadCanvas(projectId, canvasId, key);
    if (!project || !loaded) {
      throw new Error("El lienzo no existe.");
    }
    const canvases = await this.getCanvasRecords(projectId);
    const id = createId();
    const now = Date.now();
    const payload: CanvasPayload = {
      ...loaded.payload,
      views: loaded.payload.views.map((view) => ({
        ...view,
        id: createId(),
        canvasId: id,
      })),
    };
    const canvas: CanvasRecord = {
      id,
      projectId,
      name: `${loaded.name} (copia)`,
      createdAt: now,
      updatedAt: now,
      order: canvases.length,
      payload: await createEnvelope(project, `canvas:${id}`, payload, key),
      schemaVersion: WORKSPACE_SCHEMA_VERSION,
    };
    const fileRecords: WorkspaceFileRecord[] = [];
    for (const file of Object.values(loaded.files)) {
      fileRecords.push({
        id: file.id,
        projectId,
        canvasId: id,
        updatedAt: now,
        fingerprint: fingerprintFile(file),
        data: await createEnvelope(project, `file:${id}:${file.id}`, file, key),
        schemaVersion: WORKSPACE_SCHEMA_VERSION,
      });
    }
    project.updatedAt = now;
    await this.writeProjectData({
      project,
      canvases: [canvas],
      files: fileRecords,
    });
    return toCanvasSummary(canvas);
  }

  async reorderCanvases(projectId: string, ids: string[]) {
    const records = await this.getCanvasRecords(projectId);
    const byId = new Map(records.map((record) => [record.id, record]));
    const db = await this.database;
    const transaction = db.transaction(STORES.canvases, "readwrite");
    ids.forEach((id, order) => {
      const record = byId.get(id);
      if (record) {
        transaction.objectStore(STORES.canvases).put({ ...record, order });
      }
    });
    await transactionToPromise(transaction);
  }

  async deleteCanvas(projectId: string, canvasId: string) {
    const canvases = await this.getCanvasRecords(projectId);
    const files = await this.getFileRecords(projectId, canvasId);
    const db = await this.database;
    const transaction = db.transaction(
      [STORES.canvases, STORES.files],
      "readwrite",
    );
    transaction.objectStore(STORES.canvases).delete(canvasId);
    files.forEach((file) =>
      transaction
        .objectStore(STORES.files)
        .delete([projectId, canvasId, file.id]),
    );
    await transactionToPromise(transaction);
    await this.reorderCanvases(
      projectId,
      canvases
        .filter((canvas) => canvas.id !== canvasId)
        .map((canvas) => canvas.id),
    );
    const thumbnails = await this.getThumbnailRecords(projectId);
    const thumbnailTransaction = db.transaction(STORES.thumbnails, "readwrite");
    const thumbnailStore = thumbnailTransaction.objectStore(STORES.thumbnails);
    thumbnails
      .filter((thumbnail) => thumbnail.canvasId === canvasId)
      .forEach((thumbnail) => thumbnailStore.delete(thumbnail.id));
    await transactionToPromise(thumbnailTransaction);
  }

  async saveProjectThumbnail(
    projectId: string,
    canvasId: string,
    dataURL?: string,
  ) {
    const [project, canvases] = await Promise.all([
      this.getProjectRecord(projectId),
      this.getCanvasRecords(projectId),
    ]);
    if (!project || !canvases.some((canvas) => canvas.id === canvasId)) {
      return;
    }
    const existing =
      !dataURL || project.protection.enabled
        ? await this.getThumbnailRecords(projectId)
        : [];
    const db = await this.database;
    const transaction = db.transaction(STORES.thumbnails, "readwrite");
    const store = transaction.objectStore(STORES.thumbnails);
    if (!dataURL || project.protection.enabled) {
      existing
        .filter(
          (thumbnail) =>
            thumbnail.projectId === projectId &&
            thumbnail.canvasId === canvasId,
        )
        .forEach((thumbnail) => store.delete(thumbnail.id));
    } else {
      const thumbnail: WorkspaceThumbnailRecord = {
        id: `${projectId}:${canvasId}`,
        projectId,
        canvasId,
        dataURL,
        updatedAt: Date.now(),
      };
      store.put(thumbnail);
    }
    await transactionToPromise(transaction);
  }

  async getCanvasThumbnail(projectId: string, canvasId: string) {
    const records = await this.getThumbnailRecords(projectId);
    return records.find((thumbnail) => thumbnail.canvasId === canvasId)
      ?.dataURL;
  }

  async unlockProject(id: string, password: string) {
    const project = await this.getProjectRecord(id);
    if (!project) {
      throw new Error("El proyecto no existe.");
    }
    if (!project.protection.enabled) {
      throw new Error("El proyecto no está protegido.");
    }
    return unlockProjectKey(id, project.protection, password);
  }

  async protectProject(id: string, password: string) {
    const data = await this.getAllProjectData(id);
    if (data.project.protection.enabled) {
      throw new Error("El proyecto ya está protegido.");
    }
    const privateData = await getEnvelopeData<ProjectPrivateData>(
      id,
      "project-private",
      data.project.privateData,
    );
    const payloads = await Promise.all(
      data.canvases.map((canvas) =>
        getEnvelopeData<CanvasPayload>(
          id,
          `canvas:${canvas.id}`,
          canvas.payload,
        ),
      ),
    );
    const fileData = await Promise.all(
      data.files.map((file) =>
        getEnvelopeData<BinaryFileData>(
          id,
          `file:${file.canvasId}:${file.id}`,
          file.data,
        ),
      ),
    );
    const { protection, key } = await createProjectProtection(id, password);
    const project: ProjectRecord = { ...data.project, protection };
    project.privateData = await createEnvelope(
      project,
      "project-private",
      privateData,
      key,
    );
    const canvases = await Promise.all(
      data.canvases.map(async (canvas, index) => ({
        ...canvas,
        payload: await createEnvelope(
          project,
          `canvas:${canvas.id}`,
          payloads[index],
          key,
        ),
      })),
    );
    const files = await Promise.all(
      data.files.map(async (file, index) => ({
        ...file,
        data: await createEnvelope(
          project,
          `file:${file.canvasId}:${file.id}`,
          fileData[index],
          key,
        ),
      })),
    );
    await this.writeProjectData({ project, canvases, files });
    const db = await this.database;
    const thumbnails = await this.getThumbnailRecords(id);
    const thumbnailTransaction = db.transaction(STORES.thumbnails, "readwrite");
    thumbnails.forEach((thumbnail) =>
      thumbnailTransaction.objectStore(STORES.thumbnails).delete(thumbnail.id),
    );
    await transactionToPromise(thumbnailTransaction);
    return key;
  }

  async changePassword(
    id: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const data = await this.getAllProjectData(id);
    if (!data.project.protection.enabled) {
      throw new Error("El proyecto no está protegido.");
    }
    const oldKey = await unlockProjectKey(
      id,
      data.project.protection,
      currentPassword,
    );
    const privateData = await getEnvelopeData<ProjectPrivateData>(
      id,
      "project-private",
      data.project.privateData,
      oldKey,
    );
    const payloads = await Promise.all(
      data.canvases.map((canvas) =>
        getEnvelopeData<CanvasPayload>(
          id,
          `canvas:${canvas.id}`,
          canvas.payload,
          oldKey,
        ),
      ),
    );
    const fileData = await Promise.all(
      data.files.map((file) =>
        getEnvelopeData<BinaryFileData>(
          id,
          `file:${file.canvasId}:${file.id}`,
          file.data,
          oldKey,
        ),
      ),
    );
    const { protection, key } = await createProjectProtection(id, newPassword);
    const project: ProjectRecord = { ...data.project, protection };
    project.privateData = await createEnvelope(
      project,
      "project-private",
      privateData,
      key,
    );
    const canvases = await Promise.all(
      data.canvases.map(async (canvas, index) => ({
        ...canvas,
        payload: await createEnvelope(
          project,
          `canvas:${canvas.id}`,
          payloads[index],
          key,
        ),
      })),
    );
    const files = await Promise.all(
      data.files.map(async (file, index) => ({
        ...file,
        data: await createEnvelope(
          project,
          `file:${file.canvasId}:${file.id}`,
          fileData[index],
          key,
        ),
      })),
    );
    await this.writeProjectData({ project, canvases, files });
    return key;
  }

  async removeProtection(id: string, currentPassword: string) {
    const data = await this.getAllProjectData(id);
    if (!data.project.protection.enabled) {
      return;
    }
    const key = await unlockProjectKey(
      id,
      data.project.protection,
      currentPassword,
    );
    const privateData = await getEnvelopeData<ProjectPrivateData>(
      id,
      "project-private",
      data.project.privateData,
      key,
    );
    const project: ProjectRecord = {
      ...data.project,
      protection: { enabled: false },
      privateData: createPlainEnvelope(privateData),
    };
    const canvases = await Promise.all(
      data.canvases.map(async (canvas) => ({
        ...canvas,
        payload: createPlainEnvelope(
          await getEnvelopeData<CanvasPayload>(
            id,
            `canvas:${canvas.id}`,
            canvas.payload,
            key,
          ),
        ),
      })),
    );
    const files = await Promise.all(
      data.files.map(async (file) => ({
        ...file,
        data: createPlainEnvelope(
          await getEnvelopeData<BinaryFileData>(
            id,
            `file:${file.canvasId}:${file.id}`,
            file.data,
            key,
          ),
        ),
      })),
    );
    await this.writeProjectData({ project, canvases, files });
  }

  async exportProject(id: string): Promise<WorkspaceExport> {
    const data = await this.getAllProjectData(id);
    return {
      type: WORKSPACE_EXPORT_TYPE,
      schemaVersion: WORKSPACE_SCHEMA_VERSION,
      exportedAt: Date.now(),
      ...data,
    };
  }

  async importProject(data: WorkspaceExport, password?: string) {
    if (
      data.type !== WORKSPACE_EXPORT_TYPE ||
      data.schemaVersion !== WORKSPACE_SCHEMA_VERSION ||
      data.project.schemaVersion !== WORKSPACE_SCHEMA_VERSION ||
      !Array.isArray(data.canvases) ||
      !Array.isArray(data.files)
    ) {
      throw new Error("El archivo no es un proyecto de workspace válido.");
    }
    const existing = await this.getProjectRecord(data.project.id);
    if (!existing) {
      await this.writeProjectData(data);
      return data.project.protection.enabled
        ? {
            id: data.project.id,
            name: data.project.name,
            createdAt: data.project.createdAt,
            updatedAt: data.project.updatedAt,
            lastOpenedAt: data.project.lastOpenedAt,
            order: data.project.order,
            protection: data.project.protection,
            canvasCount: data.canvases.length,
          }
        : (await this.getProject(data.project.id))!;
    }
    let key: CryptoKey | undefined;
    if (data.project.protection.enabled) {
      if (!password) {
        throw new WorkspacePasswordRequiredError();
      }
      key = await unlockProjectKey(
        data.project.id,
        data.project.protection,
        password,
      );
    }
    const oldProjectId = data.project.id;
    const newProjectId = createId();
    const canvasIdMap = new Map(
      data.canvases.map((canvas) => [canvas.id, createId()]),
    );
    const privateData = await getEnvelopeData<ProjectPrivateData>(
      oldProjectId,
      "project-private",
      data.project.privateData,
      key,
    );
    const project: ProjectRecord = {
      ...data.project,
      id: newProjectId,
      name: `${data.project.name} (importado)`,
      order: (await this.listProjects()).length,
      privateData: createPlainEnvelope({}),
      protection: data.project.protection.enabled
        ? {
            ...data.project.protection,
            verifier: await encryptJson(
              key!,
              {
                type: "workspace-project-verifier",
                version: 1,
                projectId: newProjectId,
              },
              { projectId: newProjectId, recordType: "verifier" },
            ),
          }
        : { enabled: false },
    };
    project.privateData = await createEnvelope(
      project,
      "project-private",
      privateData,
      key,
    );
    const canvases: CanvasRecord[] = [];
    for (const source of data.canvases) {
      const id = canvasIdMap.get(source.id)!;
      const payload = await getEnvelopeData<CanvasPayload>(
        oldProjectId,
        `canvas:${source.id}`,
        source.payload,
        key,
      );
      canvases.push({
        ...source,
        id,
        projectId: newProjectId,
        payload: await createEnvelope(
          project,
          `canvas:${id}`,
          {
            ...payload,
            views: payload.views.map((view) => ({ ...view, canvasId: id })),
          },
          key,
        ),
      });
    }
    const files: WorkspaceFileRecord[] = [];
    for (const source of data.files) {
      const canvasId = canvasIdMap.get(source.canvasId)!;
      const file = await getEnvelopeData<BinaryFileData>(
        oldProjectId,
        `file:${source.canvasId}:${source.id}`,
        source.data,
        key,
      );
      files.push({
        ...source,
        projectId: newProjectId,
        canvasId,
        data: await createEnvelope(
          project,
          `file:${canvasId}:${source.id}`,
          file,
          key,
        ),
      });
    }
    await this.writeProjectData({ project, canvases, files });
    return (await this.getProject(newProjectId, key))!;
  }

  async getSettings() {
    const db = await this.database;
    const transaction = db.transaction(STORES.settings, "readonly");
    const record = await requestToPromise<
      { key: "settings"; value: WorkspaceSettings } | undefined
    >(transaction.objectStore(STORES.settings).get("settings"));
    return { ...DEFAULT_SETTINGS, ...record?.value };
  }

  async updateSettings(patch: Partial<WorkspaceSettings>) {
    const settings = { ...(await this.getSettings()), ...patch };
    const db = await this.database;
    const transaction = db.transaction(STORES.settings, "readwrite");
    transaction.objectStore(STORES.settings).put({
      key: "settings",
      value: settings,
    });
    await transactionToPromise(transaction);
  }
}

export const getProfileDatabaseName = (profileId: string) =>
  profileId === "default"
    ? WORKSPACE_DB_NAME
    : `${WORKSPACE_DB_NAME}-profile-${profileId}`;

const profileRepositories = new Map<string, IndexedDBWorkspaceRepository>();

export const getWorkspaceRepository = (profileId = "default") => {
  let repository = profileRepositories.get(profileId);
  if (!repository) {
    repository = new IndexedDBWorkspaceRepository(
      getProfileDatabaseName(profileId),
    );
    profileRepositories.set(profileId, repository);
  }
  return repository;
};

export const deleteWorkspaceProfileDatabase = async (profileId: string) => {
  const repository = profileRepositories.get(profileId);
  if (repository) {
    await repository.close();
    profileRepositories.delete(profileId);
  }
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(getProfileDatabaseName(profileId));
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(
        new Error(
          "No se pudo eliminar el perfil porque sigue abierto en otra ventana.",
        ),
      );
  });
};

export const workspaceRepository = getWorkspaceRepository();
