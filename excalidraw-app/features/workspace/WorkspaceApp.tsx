import { useCallback, useEffect, useRef, useState } from "react";

import polyfill from "@excalidraw/excalidraw/polyfill";

import "../../index.scss";

import { AppearanceDialog } from "./components/AppearanceDialog";
import { BackupDialog } from "./components/BackupDialog";
import { CreateProjectDialog } from "./components/CreateProjectDialog";
import { ProfileDialog } from "./components/ProfileDialog";
import { ProfileChooser } from "./components/ProfileChooser";
import {
  ProfilePasswordDialog,
  type ProfilePasswordMode,
} from "./components/ProfilePasswordDialog";
import { ProfileUnlockScreen } from "./components/ProfileUnlockScreen";
import { ProjectWorkspace } from "./components/ProjectWorkspace";
import { UnlockProjectDialog } from "./components/UnlockProjectDialog";
import { useWorkspacePrompts } from "./components/WorkspacePromptDialog";
import {
  WorkspaceDashboard,
  type ProjectAction,
} from "./components/WorkspaceDashboard";

import { migrateLegacyScene } from "./services/legacyMigration";
import { createProfileProtection, unlockProfile } from "./crypto/profileCrypto";
import {
  createWorkspaceProfile,
  getActiveProfileId,
  getWorkspaceProfiles,
  importWorkspaceProfile,
  removeWorkspaceProfile,
  renameWorkspaceProfile,
  setActiveProfileId,
  updateWorkspaceProfileAppearance,
  updateWorkspaceProfileProtection,
} from "./services/profileRegistry";
import { downloadProject, readWorkspaceFile } from "./services/projectTransfer";
import {
  downloadWorkspaceBackup,
  readWorkspaceBackup,
} from "./services/workspaceBackup";
import {
  checkForApplicationUpdate,
  type ApplicationUpdateStatus,
} from "./services/updateChecker";
import { reencryptOpenRouterConfiguration } from "./services/openRouter";
import {
  deleteWorkspaceProfileDatabase,
  getWorkspaceRepository,
} from "./storage/IndexedDBWorkspaceRepository";
import {
  WorkspacePasswordRequiredError,
  type WorkspaceRepository,
} from "./storage/WorkspaceRepository";

import "./workspace.scss";

import type { ProjectSummary, WorkspaceExport } from "./domain/types";

polyfill();

type Route =
  | { name: "dashboard" }
  | {
      name: "workspace";
      projectId: string;
      canvasId?: string;
      viewId?: string;
    };

const parseRoute = (): Route => {
  const canvasMatch = window.location.pathname.match(
    /^\/project\/([^/]+)\/canvas\/([^/]+)\/?$/,
  );
  if (canvasMatch) {
    return {
      name: "workspace",
      projectId: decodeURIComponent(canvasMatch[1]),
      canvasId: decodeURIComponent(canvasMatch[2]),
      viewId:
        new URL(window.location.href).searchParams.get("view") ?? undefined,
    };
  }
  const projectMatch = window.location.pathname.match(
    /^\/project\/([^/]+)\/?$/,
  );
  return projectMatch
    ? {
        name: "workspace",
        projectId: decodeURIComponent(projectMatch[1]),
      }
    : { name: "dashboard" };
};

const initializationPromises = new Map<string, Promise<boolean>>();

const getAccentContrast = (color: string) => {
  const [red, green, blue] = [1, 3, 5].map((offset) =>
    Number.parseInt(color.slice(offset, offset + 2), 16),
  );
  const luminance = (red * 299 + green * 587 + blue * 114) / 255000;
  return luminance > 0.58 ? "#14130f" : "#ffffff";
};

const WorkspaceApp = () => {
  const [profiles, setProfiles] = useState(getWorkspaceProfiles);
  const [activeProfileId, setActiveProfile] = useState(getActiveProfileId);
  const [profileSelected, setProfileSelected] = useState(false);
  const activeProfile =
    profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0];
  const repository = getWorkspaceRepository(activeProfile.id);
  const [route, setRoute] = useState<Route>(parseRoute);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [profileDialog, setProfileDialog] = useState<
    "create" | "rename" | null
  >(null);
  const [profilePasswordMode, setProfilePasswordMode] =
    useState<ProfilePasswordMode | null>(null);
  const [unlockTarget, setUnlockTarget] = useState<ProjectSummary | null>(null);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [sessionVersion, setSessionVersion] = useState(0);
  const [profileSessionVersion, setProfileSessionVersion] = useState(0);
  const [updateStatus, setUpdateStatus] = useState<ApplicationUpdateStatus>({
    state: "idle",
    version: import.meta.env.VITE_APP_VERSION ?? "dev",
  });
  const { askText, askConfirm, promptDialog } = useWorkspacePrompts();
  const projectKeys = useRef(new Map<string, CryptoKey>());
  const profileKeys = useRef(new Map<string, CryptoKey>());
  const unlockedProfileIds = useRef(new Set<string>());
  const activeProfileLocked =
    activeProfile.protection.enabled &&
    !unlockedProfileIds.current.has(activeProfile.id);

  useEffect(() => {
    const root = document.documentElement;
    const { accentColor, accentStyle, accentIntensity } =
      activeProfile.appearance;
    root.style.setProperty("--workspace-primary", accentColor);
    root.style.setProperty(
      "--workspace-primary-hover",
      `color-mix(in srgb, ${accentColor} 84%, white)`,
    );
    root.style.setProperty(
      "--workspace-primary-contrast",
      getAccentContrast(accentColor),
    );
    document.body.classList.add("workspace-themed");
    document.body.dataset.workspaceAccentStyle = accentStyle;
    document.body.dataset.workspaceAccentIntensity = accentIntensity;
  }, [activeProfile.appearance]);

  const checkForUpdates = useCallback(async () => {
    setUpdateStatus({ state: "checking" });
    try {
      setUpdateStatus(
        window.xcalidrawDesktop
          ? await window.xcalidrawDesktop.checkForUpdates()
          : await checkForApplicationUpdate(),
      );
    } catch (updateError) {
      setUpdateStatus({
        state: "error",
        version: import.meta.env.VITE_APP_VERSION ?? "dev",
        message:
          updateError instanceof Error
            ? updateError.message
            : "No se pudo comprobar la actualización.",
      });
    }
  }, []);

  useEffect(() => {
    if (!window.xcalidrawDesktop) {
      return;
    }
    return window.xcalidrawDesktop.onUpdateStatus(setUpdateStatus);
  }, []);

  const downloadUpdate = useCallback(async () => {
    if (updateStatus.state !== "available") {
      return;
    }
    const availableUpdate = updateStatus;
    if (!window.xcalidrawDesktop) {
      if (!availableUpdate.downloadUrl) {
        setUpdateStatus({
          state: "error",
          version: availableUpdate.version,
          message: "La versión publicada no incluye un instalador compatible.",
        });
        return;
      }
      window.open(availableUpdate.downloadUrl, "_blank", "noopener,noreferrer");
      return;
    }

    setUpdateStatus({
      state: "downloading",
      version: availableUpdate.version,
      latestVersion: availableUpdate.latestVersion,
    });
    try {
      setUpdateStatus(await window.xcalidrawDesktop.downloadUpdate());
    } catch (downloadError) {
      setUpdateStatus({
        state: "error",
        version: availableUpdate.version,
        message:
          downloadError instanceof Error
            ? downloadError.message
            : "No se pudo descargar la actualización.",
      });
    }
  }, [updateStatus]);

  const installUpdate = useCallback(async () => {
    if (!window.xcalidrawDesktop || updateStatus.state !== "downloaded") {
      return;
    }
    try {
      setUpdateStatus(await window.xcalidrawDesktop.installUpdate());
    } catch (installError) {
      setUpdateStatus({
        state: "error",
        version: updateStatus.version,
        message:
          installError instanceof Error
            ? installError.message
            : "No se pudo reiniciar para instalar la actualización.",
      });
    }
  }, [updateStatus]);

  const refreshProjects = useCallback(async () => {
    const next = await repository.listProjects();
    setProjects(next);
    return next;
  }, [repository]);

  const navigate = useCallback((nextRoute: Route, replace = false) => {
    const path =
      nextRoute.name === "dashboard"
        ? "/"
        : nextRoute.canvasId
        ? `/project/${encodeURIComponent(
            nextRoute.projectId,
          )}/canvas/${encodeURIComponent(nextRoute.canvasId)}${
            nextRoute.viewId
              ? `?view=${encodeURIComponent(nextRoute.viewId)}`
              : ""
          }`
        : `/project/${encodeURIComponent(nextRoute.projectId)}`;
    window.history[replace ? "replaceState" : "pushState"]({}, "", path);
    setRoute(nextRoute);
  }, []);

  const navigateToCanvas = useCallback(
    (projectId: string, canvasId: string, viewId?: string) => {
      void repository.updateSettings({
        lastProjectId: projectId,
        lastCanvasId: canvasId,
      });
      navigate({ name: "workspace", projectId, canvasId, viewId });
    },
    [navigate, repository],
  );

  const navigateToEmptyProject = useCallback(
    (projectId: string, replace = false) => {
      void repository.updateSettings({
        lastProjectId: projectId,
        lastCanvasId: undefined,
      });
      navigate({ name: "workspace", projectId }, replace);
    },
    [navigate, repository],
  );

  useEffect(() => {
    const handlePopState = () => setRoute(parseRoute());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    void profileSessionVersion;
    let active = true;
    if (!profileSelected) {
      setLoading(false);
      setProjects([]);
      return () => {
        active = false;
      };
    }
    setLoading(true);
    setProjects([]);
    if (activeProfileLocked) {
      setLoading(false);
      navigate({ name: "dashboard" }, true);
      return () => {
        active = false;
      };
    }
    let initializationPromise = initializationPromises.get(activeProfile.id);
    if (!initializationPromise) {
      initializationPromise =
        activeProfile.id === "default"
          ? migrateLegacyScene(repository)
          : repository
              .updateSettings({ legacyMigrationCompleted: true })
              .then(() => false);
      initializationPromises.set(activeProfile.id, initializationPromise);
    }
    void initializationPromise
      .then(async (migrated) => {
        const nextProjects = await repository.listProjects();
        if (!active) {
          return;
        }
        setProjects(nextProjects);
        if (migrated) {
          setMessage("Tu lienzo anterior se migró a “Proyecto importado”.");
        }
      })
      .catch((initError) => {
        if (active) {
          setError(
            initError instanceof Error
              ? initError.message
              : "No se pudo abrir el almacenamiento local.",
          );
        }
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [
    activeProfile.id,
    activeProfileLocked,
    navigate,
    profileSelected,
    profileSessionVersion,
    repository,
  ]);

  useEffect(() => {
    void sessionVersion;
    if (route.name !== "workspace" || loading) {
      return;
    }
    const project = projects.find((item) => item.id === route.projectId);
    if (!project) {
      setMessage("El proyecto solicitado no existe o fue eliminado.");
      navigate({ name: "dashboard" }, true);
      return;
    }
    if (project.protection.enabled && !projectKeys.current.has(project.id)) {
      setUnlockTarget(project);
    } else {
      setUnlockTarget(null);
    }
  }, [loading, navigate, projects, route, sessionVersion]);

  const getKeyForProtectedProject = useCallback(
    async (project: ProjectSummary) => {
      const cached = projectKeys.current.get(project.id);
      if (cached) {
        return cached;
      }
      const password = await askText({
        title: `Desbloquear “${project.name}”`,
        description:
          "La contraseña se usa localmente para descifrar este proyecto.",
        label: "Contraseña",
        inputType: "password",
        autoComplete: "current-password",
        confirmLabel: "Desbloquear",
      });
      if (!password) {
        throw new Error("La operación fue cancelada.");
      }
      const key = await repository.unlockProject(project.id, password);
      projectKeys.current.set(project.id, key);
      setSessionVersion((version) => version + 1);
      return key;
    },
    [askText, repository],
  );

  const importProjectData = useCallback(
    async (targetRepository: WorkspaceRepository, data: WorkspaceExport) => {
      try {
        return await targetRepository.importProject(data);
      } catch (importError) {
        if (!(importError instanceof WorkspacePasswordRequiredError)) {
          throw importError;
        }
        const password = await askText({
          title: "Restaurar copia protegida",
          description: `Ya existe “${data.project.name}” con el mismo ID. Introduce la contraseña del backup para restaurarlo con IDs nuevos.`,
          label: "Contraseña del backup",
          inputType: "password",
          confirmLabel: "Restaurar copia",
        });
        if (!password) {
          throw new Error("La restauración fue cancelada.");
        }
        return targetRepository.importProject(data, password);
      }
    },
    [askText],
  );

  const openProject = useCallback(
    async (project: ProjectSummary) => {
      if (project.protection.enabled && !projectKeys.current.has(project.id)) {
        setUnlockTarget(project);
        return;
      }
      const canvases = await repository.listCanvases(project.id);
      if (!canvases[0]) {
        navigateToEmptyProject(project.id);
        return;
      }
      navigateToCanvas(project.id, canvases[0].id);
    },
    [navigateToCanvas, navigateToEmptyProject, repository],
  );

  const reorderProject = useCallback(
    async (project: ProjectSummary, direction: -1 | 1) => {
      const index = projects.findIndex((item) => item.id === project.id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= projects.length) {
        return;
      }
      const next = projects.slice();
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      setProjects(next.map((item, order) => ({ ...item, order })));
      await repository.reorderProjects(next.map((item) => item.id));
    },
    [projects, repository],
  );

  const handleProjectAction = useCallback(
    async (project: ProjectSummary, action: ProjectAction) => {
      setError(undefined);
      try {
        if (action === "open") {
          await openProject(project);
        } else if (action === "rename") {
          const name = await askText({
            title: "Renombrar proyecto",
            description:
              "Este nombre aparecerá en el dashboard y en las referencias del lienzo.",
            label: "Nombre del proyecto",
            initialValue: project.name,
            confirmLabel: "Guardar nombre",
            maxLength: 120,
          });
          if (name?.trim()) {
            await repository.updateProject(project.id, { name });
            await refreshProjects();
          }
        } else if (action === "duplicate") {
          const key = project.protection.enabled
            ? await getKeyForProtectedProject(project)
            : undefined;
          const copy = await repository.duplicateProject(project.id, key);
          if (key) {
            projectKeys.current.set(copy.id, key);
            setSessionVersion((version) => version + 1);
          }
          await refreshProjects();
          setMessage(`Se creó “${copy.name}”.`);
        } else if (action === "protect") {
          const acceptedRisk = await askConfirm({
            title: "Proteger este proyecto",
            description:
              "No existe recuperación de contraseña. Si la pierdes, el contenido cifrado no podrá recuperarse.",
            confirmLabel: "Entiendo, continuar",
          });
          if (!acceptedRisk) {
            return;
          }
          const password = await askText({
            title: "Crear contraseña",
            label: "Nueva contraseña",
            inputType: "password",
            autoComplete: "new-password",
            confirmLabel: "Continuar",
          });
          if (!password) {
            return;
          }
          const confirmation = await askText({
            title: "Confirmar contraseña",
            label: "Repite la nueva contraseña",
            inputType: "password",
            autoComplete: "new-password",
            confirmLabel: "Proteger proyecto",
          });
          if (password !== confirmation) {
            throw new Error("Las contraseñas no coinciden.");
          }
          const key = await repository.protectProject(project.id, password);
          projectKeys.current.set(project.id, key);
          setSessionVersion((version) => version + 1);
          await refreshProjects();
        } else if (action === "change-password") {
          const current = await askText({
            title: "Cambiar contraseña",
            label: "Contraseña actual",
            inputType: "password",
            autoComplete: "current-password",
            confirmLabel: "Continuar",
          });
          const next = current
            ? await askText({
                title: "Nueva contraseña",
                label: "Nueva contraseña",
                inputType: "password",
                autoComplete: "new-password",
                confirmLabel: "Continuar",
              })
            : null;
          const confirmation = next
            ? await askText({
                title: "Confirmar contraseña",
                label: "Repite la nueva contraseña",
                inputType: "password",
                autoComplete: "new-password",
                confirmLabel: "Cambiar contraseña",
              })
            : null;
          if (!current || !next) {
            return;
          }
          if (next !== confirmation) {
            throw new Error("Las contraseñas no coinciden.");
          }
          const key = await repository.changePassword(
            project.id,
            current,
            next,
          );
          projectKeys.current.set(project.id, key);
          setSessionVersion((version) => version + 1);
          setMessage(
            "La contraseña se cambió y todo el proyecto fue recifrado.",
          );
          await refreshProjects();
        } else if (action === "remove-password") {
          const confirmed = await askConfirm({
            title: "Quitar contraseña",
            description:
              "El proyecto dejará de estar cifrado en este dispositivo.",
            confirmLabel: "Quitar cifrado",
            destructive: true,
          });
          if (!confirmed) {
            return;
          }
          const current = await askText({
            title: "Verificar identidad",
            label: "Contraseña actual",
            inputType: "password",
            autoComplete: "current-password",
            confirmLabel: "Quitar cifrado",
          });
          if (!current) {
            return;
          }
          await repository.removeProtection(project.id, current);
          projectKeys.current.delete(project.id);
          setSessionVersion((version) => version + 1);
          await refreshProjects();
        } else if (action === "lock") {
          projectKeys.current.delete(project.id);
          setSessionVersion((version) => version + 1);
          if (route.name === "workspace" && route.projectId === project.id) {
            navigate({ name: "dashboard" });
          }
        } else if (action === "export") {
          await downloadProject(repository, project.id);
        } else if (action === "delete") {
          const confirmed = await askConfirm({
            title: `Eliminar “${project.name}”`,
            description:
              "Se borrarán localmente todos sus lienzos, archivos y vistas. Esta acción es definitiva.",
            confirmLabel: "Eliminar proyecto",
            destructive: true,
          });
          if (confirmed) {
            await repository.deleteProject(project.id);
            projectKeys.current.delete(project.id);
            await refreshProjects();
          }
        } else if (action === "move-up") {
          await reorderProject(project, -1);
        } else if (action === "move-down") {
          await reorderProject(project, 1);
        }
      } catch (actionError) {
        setError(
          actionError instanceof Error
            ? actionError.message
            : "No se pudo completar la acción.",
        );
      }
    },
    [
      askConfirm,
      askText,
      getKeyForProtectedProject,
      navigate,
      openProject,
      refreshProjects,
      reorderProject,
      repository,
      route,
    ],
  );

  const unlockedProjectIds = new Set(projectKeys.current.keys());

  const switchProfile = (profileId: string, keepUnlocked = false) => {
    const retainedProfileKey = keepUnlocked
      ? profileKeys.current.get(profileId)
      : undefined;
    const retainUnlockedProfile =
      keepUnlocked && unlockedProfileIds.current.has(profileId);
    unlockedProfileIds.current.clear();
    profileKeys.current.clear();
    if (retainUnlockedProfile) {
      unlockedProfileIds.current.add(profileId);
    }
    if (retainedProfileKey) {
      profileKeys.current.set(profileId, retainedProfileKey);
    }
    projectKeys.current.clear();
    setSessionVersion((version) => version + 1);
    if (profileId !== activeProfile.id) {
      setActiveProfileId(profileId);
      setActiveProfile(profileId);
    }
    setProfileSelected(true);
    setLoading(true);
    setMessage(undefined);
    setError(undefined);
    navigate({ name: "dashboard" }, true);
  };

  const showProfileChooser = () => {
    unlockedProfileIds.current.clear();
    profileKeys.current.clear();
    projectKeys.current.clear();
    setProjects([]);
    setLoading(false);
    setProfileSelected(false);
    setMessage(undefined);
    setError(undefined);
    navigate({ name: "dashboard" }, true);
  };

  if (!profileSelected) {
    return <ProfileChooser profiles={profiles} onSelect={switchProfile} />;
  }

  if (loading) {
    return (
      <main className="workspace-loading">
        <div className="workspace-loader" />
        <p>Preparando tu workspace local…</p>
      </main>
    );
  }

  if (activeProfileLocked) {
    return (
      <ProfileUnlockScreen
        profile={activeProfile}
        profiles={profiles}
        onProfileChange={switchProfile}
        onUnlock={async (password) => {
          if (!activeProfile.protection.enabled) {
            return;
          }
          const key = await unlockProfile(
            activeProfile.id,
            activeProfile.protection,
            password,
          );
          profileKeys.current.set(activeProfile.id, key);
          unlockedProfileIds.current.add(activeProfile.id);
          setProfileSessionVersion((version) => version + 1);
        }}
      />
    );
  }

  const activeProject =
    route.name === "workspace"
      ? projects.find((project) => project.id === route.projectId)
      : undefined;
  const activeKey = activeProject
    ? projectKeys.current.get(activeProject.id)
    : undefined;

  return (
    <>
      {route.name === "workspace" &&
      activeProject &&
      (!activeProject.protection.enabled || activeKey) ? (
        <ProjectWorkspace
          repository={repository}
          projectId={route.projectId}
          canvasId={route.canvasId}
          targetViewId={route.viewId}
          projectKey={activeKey}
          profileId={activeProfile.id}
          profileName={activeProfile.name}
          profileProtection={activeProfile.protection}
          profileKey={profileKeys.current.get(activeProfile.id)}
          onVerifyProfilePassword={async (password) => {
            if (!activeProfile.protection.enabled) {
              throw new Error(
                "Añade una contraseña al perfil antes de configurar OpenRouter.",
              );
            }
            const key = await unlockProfile(
              activeProfile.id,
              activeProfile.protection,
              password,
            );
            profileKeys.current.set(activeProfile.id, key);
            setProfileSessionVersion((version) => version + 1);
            return key;
          }}
          onBack={() => navigate({ name: "dashboard" })}
          onNavigateCanvas={(canvasId) =>
            navigateToCanvas(route.projectId, canvasId)
          }
          onNavigateEmpty={() => navigateToEmptyProject(route.projectId, true)}
          onNavigateReference={(projectId, canvasId, viewId) =>
            navigateToCanvas(projectId, canvasId, viewId)
          }
          onLock={() => {
            projectKeys.current.delete(route.projectId);
            setSessionVersion((version) => version + 1);
            navigate({ name: "dashboard" });
          }}
          onProjectChanged={() => void refreshProjects()}
        />
      ) : (
        <WorkspaceDashboard
          projects={projects}
          profiles={profiles}
          activeProfileId={activeProfile.id}
          activeProfileProtected={activeProfile.protection.enabled}
          updateStatus={updateStatus}
          unlockedProjectIds={unlockedProjectIds}
          message={error ?? message}
          onCreate={() => setCreateOpen(true)}
          onImport={(file) => {
            void (async () => {
              try {
                const data = await readWorkspaceFile(file);
                const imported = await importProjectData(repository, data);
                await refreshProjects();
                setMessage(`Se importó “${imported.name}” correctamente.`);
                setError(undefined);
              } catch (importError) {
                setError(
                  importError instanceof Error
                    ? importError.message
                    : "No se pudo importar el proyecto.",
                );
              }
            })();
          }}
          onImportBackup={(file) => {
            void (async () => {
              try {
                const backup = await readWorkspaceBackup(file);
                const shouldMerge =
                  !projects.length ||
                  (await askConfirm({
                    title: "Combinar backup",
                    description:
                      "El backup se combinará con los proyectos existentes sin borrar nada.",
                    confirmLabel: "Combinar y restaurar",
                  }));
                if (!shouldMerge) {
                  return;
                }
                setMessage("Restaurando backup…");
                setError(undefined);
                let importedProjects = 0;
                for (const profileBackup of backup.profiles) {
                  const targetProfile = importWorkspaceProfile(
                    profileBackup.profile,
                  );
                  if (targetProfile.protection.enabled) {
                    unlockedProfileIds.current.delete(targetProfile.id);
                  }
                  const targetRepository = getWorkspaceRepository(
                    targetProfile.id,
                  );
                  const projectIdMap = new Map<string, string>();
                  for (const projectExport of profileBackup.projects) {
                    const imported = await importProjectData(
                      targetRepository,
                      projectExport,
                    );
                    projectIdMap.set(projectExport.project.id, imported.id);
                    importedProjects += 1;
                  }
                  if (profileBackup.settings) {
                    const sourceLastProjectId =
                      profileBackup.settings.lastProjectId;
                    const restoredLastProjectId = sourceLastProjectId
                      ? projectIdMap.get(sourceLastProjectId)
                      : undefined;
                    await targetRepository.updateSettings({
                      reopenLastCanvas: profileBackup.settings.reopenLastCanvas,
                      legacyMigrationCompleted: true,
                      lastProjectId: restoredLastProjectId,
                      lastCanvasId:
                        restoredLastProjectId === sourceLastProjectId
                          ? profileBackup.settings.lastCanvasId
                          : undefined,
                    });
                  }
                }
                setProfiles(getWorkspaceProfiles());
                setProfileSessionVersion((version) => version + 1);
                await refreshProjects();
                setMessage(
                  `Backup restaurado: ${importedProjects} ${
                    importedProjects === 1 ? "proyecto" : "proyectos"
                  } en ${backup.profiles.length} ${
                    backup.profiles.length === 1 ? "perfil" : "perfiles"
                  }.`,
                );
              } catch (backupError) {
                setError(
                  backupError instanceof Error
                    ? backupError.message
                    : "No se pudo restaurar el backup.",
                );
              }
            })();
          }}
          onExportBackup={() => setBackupOpen(true)}
          onShowProfileChooser={showProfileChooser}
          onCreateProfile={() => setProfileDialog("create")}
          onRenameProfile={() => setProfileDialog("rename")}
          onAppearance={() => setAppearanceOpen(true)}
          onProfilePasswordAction={setProfilePasswordMode}
          onLockProfile={() => {
            unlockedProfileIds.current.delete(activeProfile.id);
            profileKeys.current.delete(activeProfile.id);
            projectKeys.current.clear();
            navigate({ name: "dashboard" }, true);
            setProfileSessionVersion((version) => version + 1);
          }}
          onCheckForUpdates={() => void checkForUpdates()}
          onDownloadUpdate={() => void downloadUpdate()}
          onInstallUpdate={() => void installUpdate()}
          onDeleteProfile={() => {
            void (async () => {
              const confirmed = await askConfirm({
                title: `Eliminar el perfil “${activeProfile.name}”`,
                description:
                  "Se eliminarán todos sus proyectos y datos locales. Esta acción es definitiva.",
                confirmLabel: "Eliminar perfil",
                destructive: true,
              });
              if (!confirmed) {
                return;
              }
              try {
                const nextProfiles = profiles.filter(
                  (profile) => profile.id !== activeProfile.id,
                );
                const nextProfile = nextProfiles[0];
                if (!nextProfile) {
                  throw new Error("Debe existir al menos un perfil.");
                }
                navigate({ name: "dashboard" }, true);
                projectKeys.current.clear();
                unlockedProfileIds.current.delete(activeProfile.id);
                profileKeys.current.delete(activeProfile.id);
                await deleteWorkspaceProfileDatabase(activeProfile.id);
                setProfiles(removeWorkspaceProfile(activeProfile.id));
                setActiveProfileId(nextProfile.id);
                setActiveProfile(nextProfile.id);
                setMessage(`Se eliminó el perfil “${activeProfile.name}”.`);
              } catch (profileError) {
                setError(
                  profileError instanceof Error
                    ? profileError.message
                    : "No se pudo eliminar el perfil.",
                );
              }
            })();
          }}
          onProjectAction={(project, action) =>
            void handleProjectAction(project, action)
          }
        />
      )}

      {backupOpen && (
        <BackupDialog
          profileName={activeProfile.name}
          profileCount={profiles.length}
          onCancel={() => setBackupOpen(false)}
          onExport={async (options) => {
            const selectedProfiles =
              options.scope === "profile" ? [activeProfile] : profiles;
            await downloadWorkspaceBackup(
              selectedProfiles.map((profile) => ({
                profile,
                repository: getWorkspaceRepository(profile.id),
              })),
              options,
            );
            setBackupOpen(false);
            setMessage(
              options.scope === "profile"
                ? `Backup de “${activeProfile.name}” exportado.`
                : "Backup de todos los perfiles exportado.",
            );
            setError(undefined);
          }}
        />
      )}

      {appearanceOpen && (
        <AppearanceDialog
          initialAppearance={activeProfile.appearance}
          onCancel={() => setAppearanceOpen(false)}
          onSave={async (appearance) => {
            setProfiles(
              updateWorkspaceProfileAppearance(activeProfile.id, appearance),
            );
            setAppearanceOpen(false);
            setMessage("Apariencia actualizada.");
          }}
        />
      )}

      {profileDialog && (
        <ProfileDialog
          mode={profileDialog}
          initialName={
            profileDialog === "rename" ? activeProfile.name : undefined
          }
          onCancel={() => setProfileDialog(null)}
          onSubmit={async ({ name, password }) => {
            if (profileDialog === "create") {
              const profile = await createWorkspaceProfile(name, password);
              if (profile.protection.enabled) {
                unlockedProfileIds.current.add(profile.id);
                if (password) {
                  profileKeys.current.set(
                    profile.id,
                    await unlockProfile(
                      profile.id,
                      profile.protection,
                      password,
                    ),
                  );
                }
              }
              setProfiles(getWorkspaceProfiles());
              setProfileDialog(null);
              switchProfile(profile.id, true);
            } else {
              setProfiles(renameWorkspaceProfile(activeProfile.id, name));
              setProfileDialog(null);
            }
          }}
        />
      )}

      {profilePasswordMode && (
        <ProfilePasswordDialog
          mode={profilePasswordMode}
          profileName={activeProfile.name}
          onCancel={() => setProfilePasswordMode(null)}
          onSubmit={async ({ currentPassword, newPassword }) => {
            let currentKey: CryptoKey | undefined;
            if (profilePasswordMode !== "add") {
              if (!activeProfile.protection.enabled || !currentPassword) {
                throw new Error("La contraseña actual es obligatoria.");
              }
              currentKey = await unlockProfile(
                activeProfile.id,
                activeProfile.protection,
                currentPassword,
              );
              profileKeys.current.set(activeProfile.id, currentKey);
            }
            if (profilePasswordMode === "remove") {
              const settings = await repository.getSettings();
              if (settings.ai) {
                throw new Error(
                  "Borra primero la API key de OpenRouter. No puede quedar almacenada en un perfil sin contraseña.",
                );
              }
            }
            const protection =
              profilePasswordMode === "remove"
                ? ({ enabled: false } as const)
                : await createProfileProtection(
                    activeProfile.id,
                    newPassword ?? "",
                  );
            let nextKey: CryptoKey | undefined;
            if (protection.enabled) {
              nextKey = await unlockProfile(
                activeProfile.id,
                protection,
                newPassword ?? "",
              );
              if (profilePasswordMode === "change" && currentKey) {
                await reencryptOpenRouterConfiguration({
                  repository,
                  profileId: activeProfile.id,
                  currentKey,
                  nextKey,
                });
              }
            }
            setProfiles(
              updateWorkspaceProfileProtection(activeProfile.id, protection),
            );
            if (protection.enabled && nextKey) {
              unlockedProfileIds.current.add(activeProfile.id);
              profileKeys.current.set(activeProfile.id, nextKey);
            } else {
              unlockedProfileIds.current.delete(activeProfile.id);
              profileKeys.current.delete(activeProfile.id);
            }
            setProfilePasswordMode(null);
            setMessage(
              profilePasswordMode === "remove"
                ? "Se quitó la contraseña del perfil."
                : "La contraseña del perfil se actualizó.",
            );
          }}
        />
      )}

      {createOpen && (
        <CreateProjectDialog
          onCancel={() => setCreateOpen(false)}
          onCreate={async (input) => {
            const created = await repository.createProject(input);
            if (created.key) {
              projectKeys.current.set(created.project.id, created.key);
              setSessionVersion((version) => version + 1);
            }
            setCreateOpen(false);
            await refreshProjects();
            navigateToCanvas(created.project.id, created.canvas.id);
          }}
        />
      )}

      {unlockTarget && (
        <UnlockProjectDialog
          projectName={unlockTarget.name}
          onCancel={() => {
            setUnlockTarget(null);
            if (route.name === "workspace") {
              navigate({ name: "dashboard" });
            }
          }}
          onUnlock={async (password) => {
            const key = await repository.unlockProject(
              unlockTarget.id,
              password,
            );
            projectKeys.current.set(unlockTarget.id, key);
            setSessionVersion((version) => version + 1);
            setUnlockTarget(null);
            if (route.name !== "workspace") {
              await openProject(unlockTarget);
            }
          }}
        />
      )}
      {promptDialog}
    </>
  );
};

export default WorkspaceApp;
