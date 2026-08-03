import { IndexedDBWorkspaceRepository } from "../storage/IndexedDBWorkspaceRepository";

describe("IndexedDBWorkspaceRepository", () => {
  it("releases open connections when the profile database is deleted", async () => {
    const databaseName = `workspace-versionchange-${globalThis.crypto.randomUUID()}`;
    const firstWindow = new IndexedDBWorkspaceRepository(databaseName);
    const secondWindow = new IndexedDBWorkspaceRepository(databaseName);

    await Promise.all([firstWindow.getSettings(), secondWindow.getSettings()]);

    await expect(
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(databaseName);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        request.onblocked = () =>
          reject(new Error("La otra ventana no liberó IndexedDB."));
      }),
    ).resolves.toBeUndefined();
  });

  it("creates, persists, renames, duplicates, orders and deletes canvases", async () => {
    const repository = new IndexedDBWorkspaceRepository();
    const suffix = globalThis.crypto.randomUUID();
    const created = await repository.createProject({
      name: `Proyecto ${suffix}`,
      description: "Privado",
    });

    const details = await repository.getProject(created.project.id);
    expect(details?.description).toBe("Privado");
    expect(details?.canvasCount).toBe(1);

    const second = await repository.createCanvas(
      created.project.id,
      "Arquitectura",
    );
    await repository.renameCanvas(
      created.project.id,
      created.canvas.id,
      "Inicio",
    );
    const copy = await repository.duplicateCanvas(
      created.project.id,
      second.id,
    );
    await repository.reorderCanvases(created.project.id, [
      copy.id,
      second.id,
      created.canvas.id,
    ]);

    const canvases = await repository.listCanvases(created.project.id);
    expect(canvases.map((canvas) => canvas.name)).toEqual([
      "Arquitectura (copia)",
      "Arquitectura",
      "Inicio",
    ]);
    expect(
      await repository.loadCanvas(created.project.id, copy.id),
    ).not.toBeNull();

    await repository.deleteCanvas(created.project.id, second.id);
    expect(await repository.listCanvases(created.project.id)).toHaveLength(2);
    await repository.deleteProject(created.project.id);
    expect(await repository.getProject(created.project.id)).toBeNull();
  });
});
