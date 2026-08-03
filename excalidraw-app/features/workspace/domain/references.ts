export const WORKSPACE_REFERENCE_SCHEME = "xcalidraw://workspace";

export type WorkspaceReferenceTarget = {
  kind: "project" | "canvas" | "view";
  projectId: string;
  canvasId?: string;
  viewId?: string;
};

export const createWorkspaceReferenceLink = (
  target: WorkspaceReferenceTarget,
) => {
  const url = new URL(WORKSPACE_REFERENCE_SCHEME);
  url.searchParams.set("kind", target.kind);
  url.searchParams.set("project", target.projectId);
  if (target.canvasId) {
    url.searchParams.set("canvas", target.canvasId);
  }
  if (target.viewId) {
    url.searchParams.set("view", target.viewId);
  }
  return url.toString();
};

export const parseWorkspaceReferenceLink = (
  value?: string | null,
): WorkspaceReferenceTarget | null => {
  if (!value?.startsWith(`${WORKSPACE_REFERENCE_SCHEME}?`)) {
    return null;
  }
  try {
    const url = new URL(value);
    const kind = url.searchParams.get("kind");
    const projectId = url.searchParams.get("project")?.trim();
    const canvasId = url.searchParams.get("canvas")?.trim() || undefined;
    const viewId = url.searchParams.get("view")?.trim() || undefined;
    if (
      !projectId ||
      (kind !== "project" && kind !== "canvas" && kind !== "view") ||
      ((kind === "canvas" || kind === "view") && !canvasId) ||
      (kind === "view" && !viewId)
    ) {
      return null;
    }
    if (kind === "view") {
      return { kind, projectId, canvasId, viewId };
    }
    if (kind === "canvas") {
      return { kind, projectId, canvasId };
    }
    return { kind, projectId };
  } catch {
    return null;
  }
};
