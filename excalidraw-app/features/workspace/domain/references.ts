export const WORKSPACE_REFERENCE_SCHEME = "xcalidraw://workspace";

export type WorkspaceReferenceTarget = {
  kind: "project" | "canvas" | "view";
  projectId: string;
  canvasId?: string;
  viewId?: string;
};

type WorkspaceReferenceElement = {
  id: string;
  isDeleted?: boolean;
  link?: string | null;
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

const targetsMatch = (
  first: WorkspaceReferenceTarget,
  second: WorkspaceReferenceTarget,
) =>
  first.kind === second.kind &&
  first.projectId === second.projectId &&
  first.canvasId === second.canvasId &&
  first.viewId === second.viewId;

/**
 * Resolves Quick Look only when every selected element belongs to the same
 * workspace shortcut. Reference cards are groups whose elements share a link.
 */
export const getSelectedWorkspaceReferenceTarget = (
  elements: readonly WorkspaceReferenceElement[],
  selectedElementIds: Readonly<Record<string, boolean | undefined>>,
): WorkspaceReferenceTarget | null => {
  let selectedCount = 0;
  let selectedTarget: WorkspaceReferenceTarget | null = null;

  for (const element of elements) {
    if (element.isDeleted || !selectedElementIds[element.id]) {
      continue;
    }
    selectedCount += 1;
    const target = parseWorkspaceReferenceLink(element.link);
    if (!target || (selectedTarget && !targetsMatch(selectedTarget, target))) {
      return null;
    }
    selectedTarget = target;
  }

  return selectedCount > 0 ? selectedTarget : null;
};
