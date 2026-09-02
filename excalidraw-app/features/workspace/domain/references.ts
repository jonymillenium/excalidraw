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
  customData?: Record<string, unknown> & { workspaceReference?: unknown };
};

const normalizeWorkspaceReferenceTarget = (
  value: unknown,
): WorkspaceReferenceTarget | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Partial<WorkspaceReferenceTarget>;
  const projectId = candidate.projectId?.trim();
  const canvasId = candidate.canvasId?.trim() || undefined;
  const viewId = candidate.viewId?.trim() || undefined;
  if (
    !projectId ||
    (candidate.kind !== "project" &&
      candidate.kind !== "canvas" &&
      candidate.kind !== "view") ||
    ((candidate.kind === "canvas" || candidate.kind === "view") && !canvasId) ||
    (candidate.kind === "view" && !viewId)
  ) {
    return null;
  }
  if (candidate.kind === "view") {
    return { kind: candidate.kind, projectId, canvasId, viewId };
  }
  if (candidate.kind === "canvas") {
    return { kind: candidate.kind, projectId, canvasId };
  }
  return { kind: candidate.kind, projectId };
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
    const target =
      parseWorkspaceReferenceLink(element.link) ??
      normalizeWorkspaceReferenceTarget(element.customData?.workspaceReference);
    if (!target || (selectedTarget && !targetsMatch(selectedTarget, target))) {
      return null;
    }
    selectedTarget = target;
  }

  return selectedCount > 0 ? selectedTarget : null;
};
