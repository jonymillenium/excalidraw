import { describe, expect, it } from "vitest";

import {
  createWorkspaceReferenceLink,
  getSelectedWorkspaceReferenceTarget,
  parseWorkspaceReferenceLink,
} from "../domain/references";

describe("workspace references", () => {
  it("round-trips a canvas reference with encoded identifiers", () => {
    const target = {
      kind: "canvas" as const,
      projectId: "product / 2026",
      canvasId: "research?one",
    };
    expect(
      parseWorkspaceReferenceLink(createWorkspaceReferenceLink(target)),
    ).toEqual(target);
  });

  it("round-trips a deep reference to a saved view", () => {
    const target = {
      kind: "view" as const,
      projectId: "product",
      canvasId: "roadmap",
      viewId: "executive / overview",
    };
    expect(
      parseWorkspaceReferenceLink(createWorkspaceReferenceLink(target)),
    ).toEqual(target);
  });

  it("rejects incomplete or external links", () => {
    expect(parseWorkspaceReferenceLink("https://example.com")).toBeNull();
    expect(
      parseWorkspaceReferenceLink(
        "xcalidraw://workspace?kind=canvas&project=project-1",
      ),
    ).toBeNull();
    expect(
      parseWorkspaceReferenceLink(
        "xcalidraw://workspace?kind=view&project=project-1&canvas=canvas-1",
      ),
    ).toBeNull();
  });

  it("resolves a grouped shortcut when all selected elements share a target", () => {
    const target = {
      kind: "view" as const,
      projectId: "project-1",
      canvasId: "canvas-1",
      viewId: "view-1",
    };
    const link = createWorkspaceReferenceLink(target);

    expect(
      getSelectedWorkspaceReferenceTarget(
        [
          { id: "card", link },
          { id: "thumbnail", link },
          { id: "title", link },
        ],
        { card: true, thumbnail: true, title: true },
      ),
    ).toEqual(target);
  });

  it("does not resolve a mixed selection", () => {
    const link = createWorkspaceReferenceLink({
      kind: "canvas",
      projectId: "project-1",
      canvasId: "canvas-1",
    });

    expect(
      getSelectedWorkspaceReferenceTarget(
        [{ id: "card", link }, { id: "shape" }],
        { card: true, shape: true },
      ),
    ).toBeNull();
  });

  it("does not resolve two different shortcuts", () => {
    expect(
      getSelectedWorkspaceReferenceTarget(
        [
          {
            id: "first",
            link: createWorkspaceReferenceLink({
              kind: "project",
              projectId: "project-1",
            }),
          },
          {
            id: "second",
            link: createWorkspaceReferenceLink({
              kind: "project",
              projectId: "project-2",
            }),
          },
        ],
        { first: true, second: true },
      ),
    ).toBeNull();
  });

  it("ignores unselected and deleted elements", () => {
    const target = {
      kind: "project" as const,
      projectId: "project-1",
    };
    const link = createWorkspaceReferenceLink(target);

    expect(
      getSelectedWorkspaceReferenceTarget(
        [
          { id: "selected", link },
          { id: "unselected" },
          { id: "deleted", isDeleted: true },
        ],
        { selected: true, deleted: true },
      ),
    ).toEqual(target);
  });

  it("resolves restored shortcuts from their embedded target metadata", () => {
    const target = {
      kind: "canvas" as const,
      projectId: "project-1",
      canvasId: "canvas-1",
    };

    expect(
      getSelectedWorkspaceReferenceTarget(
        [
          {
            id: "restored-card",
            customData: { workspaceReference: target },
          },
        ],
        { "restored-card": true },
      ),
    ).toEqual(target);
  });
});
