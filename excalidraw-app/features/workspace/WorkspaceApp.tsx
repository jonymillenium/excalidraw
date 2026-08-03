import { useCallback, useEffect, useRef, useState } from "react";

import polyfill from "@excalidraw/excalidraw/polyfill";

import "../../index.scss";

import { CreateProjectDialog } from "./components/CreateProjectDialog";
import { ProjectWorkspace } from "./components/ProjectWorkspace";
import { UnlockProjectDialog } from "./components/UnlockProjectDialog";
import {
  WorkspaceDashboard,
  type ProjectAction,
} from "./components/WorkspaceDashboard";

import { migrateLegacyScene } from "./services/legacyMigration";
import { downloadProject, readWorkspaceFile } from "./services/projectTransfer";
import { workspaceRepository } from "./storage/IndexedDBWorkspaceRepository";
import { WorkspacePasswordRequiredError } from "./storage/WorkspaceRepository";

import "./workspace.scss";

import type { ProjectSummary } from "./domain/types";

polyfill();

type Route =
  | { name: "dashboard" }
  | { name: "workspace"; projectId: string; canvasId: string };

const parseRoute = (): Route => {
  const match = window.location.pathname.match(
    /^\/project\/([^/]+)\/canvas\/([^/]+)\/?$/,
  );
  return match
    ? {
        name: "workspace",
        projectId: decodeURIComponent(match[1]),
        canvasId: decodeURIComponent(match[2]),
      }
    : { name: "dashboard" };
};

let initializationPromise: Promise<boolean> | null = null;

const WorkspaceApp = () => {
  const repository = workspaceRepository;
  const [route, setRoute] = useState<Route>(parseRoute);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [unlockTarget, setUnlockTarget] = useState<ProjectSummary | null>(null);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [sessionVersion, setSessionVersion] = useState(0);
  const projectKeys = useRef(new Map<string, CryptoKey>());

  const refreshProjects = useCallback(async () => {
    const next = await repository.listProjects();
    setProjects(next);
    return next;
  }, [repository]);

  const navigate = useCallback((nextRoute: Route, replace = false) => {
    const path =
      nextRoute.name === "dashboard"
        ? "/"
        : `/project/${encodeURIComponent(
            nextRoute.projectId,
          )}/canvas/${encodeURIComponent(nextRoute.canvasId)}`;
    window.history[replace ? "replaceState" : "pushState"]({}, "", path);
    setRoute(nextRoute);
  }, []);

  const navigateToCanvas = useCallback(
    (projectId: string, canvasId: string) => {
      void repository.updateSettings({
        lastProjectId: projectId,
        lastCanvasId: canvasId,
      });
      navigate({ name: "workspace", projectId, canvasId });
    },
    [navigate, repository],
  );

  useEffect(() => {
    const handlePopState = () => setRoute(parseRoute());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    let active = true;
    initializationPromise ??= migrateLegacyScene(repository);
    void initializationPromise
      .then(async (migrated) => {
        const [nextProjects, settings] = await Promise.all([
          repository.listProjects(),
          repository.getSettings(),
        ]);
        if (!active) {
          return;
        }
        setProjects(nextProjects);
        if (migrated) {
          setMessage("Tu lienzo anterior se migró a “Proyecto importado”.");
        }
        if (
          parseRoute().name === "dashboard" &&
          settings.reopenLastCanvas &&
          settings.lastProjectId &&
          settings.lastCanvasId &&
          nextProjects.some((project) => project.id === settings.lastProjectId)
        ) {
          navigate(
            {
              name: "workspace",
              projectId: settings.lastProjectId,
              canvasId: settings.lastCanvasId,
            },
            true,
          );
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
  }, [navigate, repository]);

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
      const password = window.prompt(`Contraseña de “${project.name}”`);
      if (!password) {
        throw new Error("La operación fue cancelada.");
      }
      const key = await repository.unlockProject(project.id, password);
      projectKeys.current.set(project.id, key);
      setSessionVersion((version) => version + 1);
      return key;
    },
    [repository],
  );

  const openProject = useCallback(
    async (project: ProjectSummary) => {
      if (project.protection.enabled && !projectKeys.current.has(project.id)) {
        setUnlockTarget(project);
        return;
      }
      const canvases = await repository.listCanvases(project.id);
      if (!canvases[0]) {
        setError("El proyecto no contiene lienzos válidos.");
        return;
      }
      navigateToCanvas(project.id, canvases[0].id);
    },
    [navigateToCanvas, repository],
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
          const name = window.prompt("Nuevo nombre del proyecto", project.name);
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
          if (
            !window.confirm(
              "No existe recuperación de contraseña. Si la pierdes, el contenido no podrá recuperarse. ¿Continuar?",
            )
          ) {
            return;
          }
          const password = window.prompt("Nueva contraseña");
          if (!password) {
            return;
          }
          const confirmation = window.prompt("Confirma la nueva contraseña");
          if (password !== confirmation) {
            throw new Error("Las contraseñas no coinciden.");
          }
          const key = await repository.protectProject(project.id, password);
          projectKeys.current.set(project.id, key);
          setSessionVersion((version) => version + 1);
          await refreshProjects();
        } else if (action === "change-password") {
          const current = window.prompt("Contraseña actual");
          const next = current ? window.prompt("Nueva contraseña") : null;
          const confirmation = next
            ? window.prompt("Confirma la nueva contraseña")
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
          if (!window.confirm("¿Quitar el cifrado de este proyecto?")) {
            return;
          }
          const current = window.prompt("Contraseña actual");
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
          if (
            window.confirm(
              `¿Eliminar “${project.name}”? Se borrarán localmente todos sus lienzos, archivos y vistas. Esta acción es definitiva.`,
            )
          ) {
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

  if (loading) {
    return (
      <main className="workspace-loading">
        <div className="workspace-loader" />
        <p>Preparando tu workspace local…</p>
      </main>
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
          projectKey={activeKey}
          onBack={() => navigate({ name: "dashboard" })}
          onNavigateCanvas={(canvasId) =>
            navigateToCanvas(route.projectId, canvasId)
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
          unlockedProjectIds={unlockedProjectIds}
          message={error ?? message}
          onCreate={() => setCreateOpen(true)}
          onImport={(file) => {
            void (async () => {
              try {
                const data = await readWorkspaceFile(file);
                let imported;
                try {
                  imported = await repository.importProject(data);
                } catch (importError) {
                  if (
                    !(importError instanceof WorkspacePasswordRequiredError)
                  ) {
                    throw importError;
                  }
                  const password = window.prompt(
                    "Ya existe un proyecto con el mismo ID. Introduce la contraseña del backup para importarlo con IDs nuevos.",
                  );
                  if (!password) {
                    return;
                  }
                  imported = await repository.importProject(data, password);
                }
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
          onProjectAction={(project, action) =>
            void handleProjectAction(project, action)
          }
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
    </>
  );
};

export default WorkspaceApp;
