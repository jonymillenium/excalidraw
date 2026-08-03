import {
  getWorkspaceProfiles,
  importWorkspaceProfile,
  renameWorkspaceProfile,
} from "../services/profileRegistry";
import { DEFAULT_WORKSPACE_APPEARANCE } from "../domain/types";

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
      protection: { enabled: false },
      appearance: {
        ...DEFAULT_WORKSPACE_APPEARANCE,
        accentColor: "#ff2800",
      },
    });

    expect(restored.name).toBe("Perfil restaurado");
    expect(restored.appearance.accentColor).toBe("#ff2800");
    expect(getWorkspaceProfiles()[0].name).toBe("Perfil restaurado");
  });

  it("upgrades legacy profiles with safe defaults", () => {
    localStorage.setItem(
      "xcalidraw.workspace.profiles.v1",
      JSON.stringify([
        {
          id: "legacy",
          name: "Anterior",
          createdAt: 1,
          updatedAt: 1,
        },
      ]),
    );

    expect(getWorkspaceProfiles()[0]).toEqual(
      expect.objectContaining({
        id: "legacy",
        protection: { enabled: false },
        appearance: DEFAULT_WORKSPACE_APPEARANCE,
      }),
    );
  });
});
