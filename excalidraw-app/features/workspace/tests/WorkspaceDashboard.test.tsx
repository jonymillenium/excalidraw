import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { WorkspaceDashboard } from "../components/WorkspaceDashboard";

const renderDashboard = (
  updateStatus: Parameters<typeof WorkspaceDashboard>[0]["updateStatus"],
) => {
  const onDownloadUpdate = vi.fn();
  const onShowProfileChooser = vi.fn();
  render(
    <WorkspaceDashboard
      projects={[]}
      profiles={[
        {
          id: "profile",
          name: "Personal",
          createdAt: 1,
          updatedAt: 1,
          protection: { enabled: false },
          appearance: {
            accentColor: "#ffd400",
            accentStyle: "contour",
            accentIntensity: "vivid",
          },
        },
      ]}
      activeProfileId="profile"
      activeProfileProtected={false}
      updateStatus={updateStatus}
      unlockedProjectIds={new Set()}
      onCreate={vi.fn()}
      onImport={vi.fn()}
      onImportBackup={vi.fn()}
      onExportBackup={vi.fn()}
      onShowProfileChooser={onShowProfileChooser}
      onCreateProfile={vi.fn()}
      onRenameProfile={vi.fn()}
      onDeleteProfile={vi.fn()}
      onAppearance={vi.fn()}
      onProfilePasswordAction={vi.fn()}
      onLockProfile={vi.fn()}
      onCheckForUpdates={vi.fn()}
      onDownloadUpdate={onDownloadUpdate}
      onProjectAction={vi.fn()}
    />,
  );
  return { onDownloadUpdate, onShowProfileChooser };
};

describe("WorkspaceDashboard updates", () => {
  it("offers the real DMG download when a release is available", () => {
    const { onDownloadUpdate } = renderDashboard({
      state: "available",
      version: "1.2.2",
      latestVersion: "1.3.0",
      url: "https://github.com/jonymillenium/excalidraw/releases/tag/xcalidraw-desktop-v1.3.0",
      downloadUrl:
        "https://github.com/jonymillenium/excalidraw/releases/download/xcalidraw-desktop-v1.3.0/Xcalidraw-1.3.0-arm64.dmg",
      assetName: "Xcalidraw-1.3.0-arm64.dmg",
      assetSize: 141_000_000,
    });

    expect(screen.getByText("Nueva versión · 1.3.0")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Descargar actualización" }),
    );
    expect(onDownloadUpdate).toHaveBeenCalledTimes(1);
  });

  it("does not offer a download before the installer is published", () => {
    renderDashboard({
      state: "pending",
      version: "1.2.2",
      currentCommit: "old",
      latestCommit: "new",
      commits: 2,
      url: "https://github.com/example/compare/old...new",
    });

    expect(screen.getByText("Versión en preparación")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Descargar actualización" }),
    ).not.toBeInTheDocument();
  });

  it("returns to the profile chooser explicitly", () => {
    const { onShowProfileChooser } = renderDashboard({
      state: "idle",
      version: "1.3.0",
    });

    fireEvent.click(screen.getByRole("button", { name: "Cambiar perfil" }));
    expect(onShowProfileChooser).toHaveBeenCalledTimes(1);
  });
});
