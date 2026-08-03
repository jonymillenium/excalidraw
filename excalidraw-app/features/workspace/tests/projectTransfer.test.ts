import {
  parseWorkspaceExport,
  serializeWorkspaceExport,
} from "../services/projectTransfer";
import {
  WORKSPACE_EXPORT_TYPE,
  WORKSPACE_SCHEMA_VERSION,
  createPlainEnvelope,
  type WorkspaceExport,
} from "../domain/types";

const projectExport: WorkspaceExport = {
  type: WORKSPACE_EXPORT_TYPE,
  schemaVersion: WORKSPACE_SCHEMA_VERSION,
  exportedAt: 1,
  project: {
    id: "project-one",
    name: "Proyecto",
    createdAt: 1,
    updatedAt: 1,
    order: 0,
    protection: { enabled: false },
    privateData: createPlainEnvelope({ description: "Descripción" }),
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
  },
  canvases: [],
  files: [],
};

describe("project transfer", () => {
  it("round-trips a versioned workspace export", () => {
    expect(
      parseWorkspaceExport(serializeWorkspaceExport(projectExport)),
    ).toEqual(projectExport);
  });

  it("rejects invalid and future formats", () => {
    expect(() => parseWorkspaceExport("not-json")).toThrow("JSON válido");
    expect(() =>
      parseWorkspaceExport(JSON.stringify({ type: "other", schemaVersion: 2 })),
    ).toThrow(".excalidraw-workspace válido");
  });
});
