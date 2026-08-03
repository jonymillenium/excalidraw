import {
  getWorkspaceProfiles,
  importWorkspaceProfile,
  renameWorkspaceProfile,
} from "../services/profileRegistry";

describe("workspace profile registry", () => {
  beforeEach(() => localStorage.clear());

  it("recovers from malformed registry data", () => {
    localStorage.setItem(
      "xcalidraw.workspace.profiles.v1",
      JSON.stringify([{ id: "broken" }]),
    );

    expect(getWorkspaceProfiles()).toEqual([
      expect.objectContaining({ id: "default", name: "Personal" }),
    ]);
  });

  it("restores metadata when importing an existing profile id", () => {
    renameWorkspaceProfile("default", "Local");
    const restored = importWorkspaceProfile({
      id: "default",
      name: "Perfil restaurado",
      createdAt: 1,
      updatedAt: 2,
    });

    expect(restored.name).toBe("Perfil restaurado");
    expect(getWorkspaceProfiles()[0].name).toBe("Perfil restaurado");
  });
});
