import { describe, expect, it } from "vitest";

import {
  createWorkspaceReferenceLink,
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
});
