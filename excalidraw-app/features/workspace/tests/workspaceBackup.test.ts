import {
  WORKSPACE_BACKUP_TYPE,
  WORKSPACE_SCHEMA_VERSION,
  createPlainEnvelope,
  type WorkspaceBackup,
} from "../domain/types";
import {
  parseWorkspaceBackup,
  serializeWorkspaceBackup,
} from "../services/workspaceBackup";

const backup: WorkspaceBackup = {
  type: WORKSPACE_BACKUP_TYPE,
  schemaVersion: WORKSPACE_SCHEMA_VERSION,
  exportedAt: 1,
  scope: "profile",
  includeSettings: true,
  profiles: [
    {
      profile: {
        id: "default",
        name: "Personal",
        createdAt: 1,
        updatedAt: 1,
      },
      settings: {
        reopenLastCanvas: true,
        legacyMigrationCompleted: true,
        schemaVersion: WORKSPACE_SCHEMA_VERSION,
      },
      projects: [
        {
          type: "excalidraw-workspace",
          schemaVersion: WORKSPACE_SCHEMA_VERSION,
          exportedAt: 1,
          project: {
            id: "project-1",
            name: "Proyecto",
            createdAt: 1,
            updatedAt: 1,
            order: 0,
            protection: { enabled: false },
            privateData: createPlainEnvelope({}),
            schemaVersion: WORKSPACE_SCHEMA_VERSION,
          },
          canvases: [],
          files: [],
        },
      ],
    },
  ],
};

describe("workspace backup", () => {
  it("round-trips a complete versioned backup", () => {
    expect(parseWorkspaceBackup(serializeWorkspaceBackup(backup))).toEqual(
      backup,
    );
  });

  it("rejects unrelated JSON", () => {
    expect(() => parseWorkspaceBackup('{"type":"unknown"}')).toThrow(
      "backup completo",
    );
  });

  it("rejects an empty or malformed profile list", () => {
    expect(() =>
      parseWorkspaceBackup(
        serializeWorkspaceBackup({ ...backup, profiles: [] }),
      ),
    ).toThrow("backup completo");
    expect(() =>
      parseWorkspaceBackup(
        JSON.stringify({
          ...backup,
          profiles: [{ profile: { id: "broken" }, projects: [] }],
        }),
      ),
    ).toThrow("backup completo");
  });
});
