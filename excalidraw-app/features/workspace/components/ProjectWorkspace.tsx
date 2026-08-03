import { useCallback, useEffect, useRef, useState } from "react";

import { Excalidraw, MainMenu, WelcomeScreen } from "@excalidraw/excalidraw";
import { THEME } from "@excalidraw/common";

import type { Theme } from "@excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  captureVisibleRect,
  createSavedView,
  moveSavedView,
  normalizeViewOrder,
} from "../domain/views";

import { useAutosaveCanvas, type SaveStatus } from "../hooks/useAutosaveCanvas";
import { CanvasLease } from "../services/canvasLease";
import { downloadProject } from "../services/projectTransfer";

import type {
  CanvasSummary,
  LoadedCanvas,
  ProjectDetails,
  SavedView,
} from "../domain/types";

import type { WorkspaceRepository } from "../storage/WorkspaceRepository";

const EditorCanvas = ({
  repository,
  projectId,
  loadedCanvas,
  projectKey,
  views,
  readOnly,
  presentation,
  onAPI,
  onFlush,
  onStatus,
}: {
  repository: WorkspaceRepository;
  projectId: string;
  loadedCanvas: LoadedCanvas;
  projectKey?: CryptoKey;
  views: SavedView[];
  readOnly: boolean;
  presentation: boolean;
  onAPI: (api: ExcalidrawImperativeAPI | null) => void;
  onFlush: (flush: () => Promise<void>) => void;
  onStatus: (status: SaveStatus, error?: Error) => void;
}) => {
  const [themePreference, setThemePreference] = useState<Theme | "system">(
    "system",
  );
  const theme: Theme =
    themePreference === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? THEME.DARK
        : THEME.LIGHT
      : themePreference;
  const { schedule, flush } = useAutosaveCanvas({
    repository,
    projectId,
    canvasId: loadedCanvas.id,
    key: projectKey,
    views,
    disabled: readOnly,
    onStatusChange: onStatus,
  });

  useEffect(() => {
    onFlush(flush);
  }, [flush, onFlush]);

  return (
    <Excalidraw
      key={loadedCanvas.id}
      name={loadedCanvas.name}
      initialData={{
        elements: loadedCanvas.payload.elements,
        appState: loadedCanvas.payload.appState,
        files: loadedCanvas.files,
      }}
      onChange={schedule}
      onExcalidrawAPI={onAPI}
      viewModeEnabled={presentation || readOnly}
      zenModeEnabled={presentation}
      interaction={!(presentation || readOnly)}
      theme={theme}
      onThemeChange={setThemePreference}
      autoFocus={!presentation}
      UIOptions={{
        canvasActions: {
          toggleTheme: true,
          export: { saveFileToDisk: true },
          loadScene: true,
          saveToActiveFile: true,
          changeViewBackgroundColor: true,
        },
      }}
    >
      {!presentation && (
        <MainMenu>
          <MainMenu.DefaultItems.LoadScene />
          <MainMenu.DefaultItems.SaveToActiveFile />
          <MainMenu.DefaultItems.SaveAsImage />
          <MainMenu.DefaultItems.Export />
          <MainMenu.Separator />
          <MainMenu.DefaultItems.ToggleTheme
            allowSystemTheme={true}
            theme={themePreference}
          />
          <MainMenu.DefaultItems.ChangeCanvasBackground />
          <MainMenu.DefaultItems.ClearCanvas />
        </MainMenu>
      )}
      {!loadedCanvas.payload.elements.length && !presentation && (
        <WelcomeScreen>
          <WelcomeScreen.Center>
            <WelcomeScreen.Center.Heading>
              Empieza a dibujar en {loadedCanvas.name}
            </WelcomeScreen.Center.Heading>
          </WelcomeScreen.Center>
        </WelcomeScreen>
      )}
    </Excalidraw>
  );
};

export const ProjectWorkspace = ({
  repository,
  projectId,
  canvasId,
  projectKey,
  onBack,
  onNavigateCanvas,
  onLock,
  onProjectChanged,
}: {
  repository: WorkspaceRepository;
  projectId: string;
  canvasId: string;
  projectKey?: CryptoKey;
  onBack: () => void;
  onNavigateCanvas: (canvasId: string) => void;
  onLock: () => void;
  onProjectChanged: () => void;
}) => {
  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [canvases, setCanvases] = useState<CanvasSummary[]>([]);
  const [loadedCanvas, setLoadedCanvas] = useState<LoadedCanvas | null>(null);
  const [views, setViews] = useState<SavedView[]>([]);
  const [selectedViewId, setSelectedViewId] = useState<string>();
  const [presentationIndex, setPresentationIndex] = useState<number | null>(
    null,
  );
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [error, setError] = useState<string>();
  const [readOnly, setReadOnly] = useState(false);
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const flushRef = useRef<() => Promise<void>>(async () => undefined);
  const criticalSaveRef = useRef<Promise<void>>(Promise.resolve());
  const leaseRef = useRef(new CanvasLease());

  useEffect(() => {
    const media = window.matchMedia("(max-width: 700px)");
    const closePanelsOnMobile = () => {
      if (media.matches) {
        setLeftOpen(false);
        setRightOpen(false);
      }
    };
    closePanelsOnMobile();
    media.addEventListener("change", closePanelsOnMobile);
    return () => media.removeEventListener("change", closePanelsOnMobile);
  }, []);

  const refreshMetadata = useCallback(async () => {
    const [nextProject, nextCanvases] = await Promise.all([
      repository.getProject(projectId, projectKey),
      repository.listCanvases(projectId),
    ]);
    if (!nextProject) {
      throw new Error("El proyecto ya no existe.");
    }
    setProject(nextProject);
    setCanvases(nextCanvases);
    return nextCanvases;
  }, [projectId, projectKey, repository]);

  useEffect(() => {
    let active = true;
    const lease = leaseRef.current;
    setError(undefined);
    void refreshMetadata()
      .then(async (nextCanvases) => {
        if (!nextCanvases.some((canvas) => canvas.id === canvasId)) {
          if (nextCanvases[0]) {
            onNavigateCanvas(nextCanvases[0].id);
          }
          return;
        }
        const nextCanvas = await repository.loadCanvas(
          projectId,
          canvasId,
          projectKey,
        );
        if (!nextCanvas) {
          throw new Error("El lienzo ya no existe.");
        }
        const ownsLease = await lease.acquire(canvasId);
        if (active) {
          setReadOnly(!ownsLease);
          setLoadedCanvas(nextCanvas);
          setViews(normalizeViewOrder(nextCanvas.payload.views));
          setSelectedViewId(undefined);
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "No se pudo cargar el lienzo.",
          );
        }
      });
    return () => {
      active = false;
      lease.release();
    };
  }, [
    canvasId,
    onNavigateCanvas,
    projectId,
    projectKey,
    refreshMetadata,
    repository,
  ]);

  const handleStatus = useCallback((status: SaveStatus, saveError?: Error) => {
    setSaveStatus(status);
    setError(saveError?.message);
  }, []);

  const persistViews = useCallback(
    async (nextViews: SavedView[]) => {
      if (!api || !loadedCanvas || readOnly) {
        return;
      }
      const previousSave = criticalSaveRef.current;
      const operation = previousSave.then(async () => {
        await flushRef.current();
        setSaveStatus("saving");
        await repository.saveCanvas(
          projectId,
          loadedCanvas.id,
          {
            elements: api.getSceneElementsIncludingDeleted(),
            appState: api.getAppState(),
            fileIds: Object.keys(
              api.getFiles(),
            ) as LoadedCanvas["payload"]["fileIds"],
            views: nextViews,
          },
          api.getFiles(),
          projectKey,
        );
        setViews(nextViews);
        setLoadedCanvas((current) =>
          current
            ? { ...current, payload: { ...current.payload, views: nextViews } }
            : current,
        );
        setSaveStatus("saved");
      });
      criticalSaveRef.current = operation.catch(() => undefined);
      try {
        await operation;
      } catch (saveError) {
        setSaveStatus("error");
        setError(
          saveError instanceof Error
            ? saveError.message
            : "No se pudo guardar.",
        );
      }
    },
    [api, loadedCanvas, projectId, projectKey, readOnly, repository],
  );

  const flushAll = useCallback(async () => {
    await criticalSaveRef.current;
    await flushRef.current();
  }, []);

  const openView = useCallback(
    (view: SavedView, index?: number) => {
      if (!api) {
        return;
      }
      setSelectedViewId(view.id);
      if (index !== undefined) {
        setPresentationIndex(index);
      }
      api.setViewport({
        target: view.rect,
        fit: "contain",
        animation: { duration: view.transitionDurationMs },
        offsets: { ui: true },
      });
    },
    [api],
  );

  useEffect(() => {
    if (presentationIndex === null) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPresentationIndex(null);
      }
      if (event.key === "ArrowRight" && presentationIndex < views.length - 1) {
        event.preventDefault();
        openView(views[presentationIndex + 1], presentationIndex + 1);
      }
      if (event.key === "ArrowLeft" && presentationIndex > 0) {
        event.preventDefault();
        openView(views[presentationIndex - 1], presentationIndex - 1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openView, presentationIndex, views]);

  const switchCanvas = async (nextCanvasId: string) => {
    if (nextCanvasId === canvasId) {
      return;
    }
    try {
      await flushAll();
      setLoadedCanvas(null);
      onNavigateCanvas(nextCanvasId);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo guardar antes de cambiar de lienzo.",
      );
    }
  };

  const moveCanvas = async (id: string, direction: -1 | 1) => {
    const index = canvases.findIndex((canvas) => canvas.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= canvases.length) {
      return;
    }
    const next = canvases.slice();
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setCanvases(next.map((canvas, order) => ({ ...canvas, order })));
    await repository.reorderCanvases(
      projectId,
      next.map((canvas) => canvas.id),
    );
  };

  const handleFlushReady = useCallback((flush: () => Promise<void>) => {
    flushRef.current = flush;
  }, []);

  if (!project || !loadedCanvas) {
    return (
      <main className="workspace-loading">
        <div className="workspace-loader" />
        <p>{error ?? "Abriendo workspace…"}</p>
        {error && (
          <button className="workspace-button" onClick={onBack}>
            Volver a proyectos
          </button>
        )}
      </main>
    );
  }

  const presentation = presentationIndex !== null;

  return (
    <main
      className={`project-workspace${presentation ? " is-presenting" : ""}`}
    >
      {!presentation && (
        <header className="project-workspace__topbar">
          <div className="project-workspace__breadcrumbs">
            <button
              className="workspace-icon-button project-workspace__back"
              type="button"
              onClick={async () => {
                await flushAll();
                onBack();
              }}
              aria-label="Volver a proyectos"
            >
              ←
            </button>
            <div>
              <strong>{project.name}</strong>
              <span>/</span>
              <span>{loadedCanvas.name}</span>
            </div>
          </div>
          <div className="project-workspace__status" role="status">
            <span className={`save-status save-status--${saveStatus}`}>
              {saveStatus === "saving"
                ? "Guardando…"
                : saveStatus === "error"
                ? "Error al guardar"
                : "Guardado"}
            </span>
            {readOnly && <span className="workspace-badge">Solo lectura</span>}
          </div>
          <div className="project-workspace__actions">
            <button
              className="workspace-button workspace-button--compact"
              onClick={() => {
                if (!leftOpen) {
                  setRightOpen(false);
                }
                setLeftOpen((open) => !open);
              }}
            >
              {leftOpen ? "Ocultar lienzos" : "Mostrar lienzos"}
            </button>
            <button
              className="workspace-button workspace-button--compact"
              onClick={() => {
                if (!rightOpen) {
                  setLeftOpen(false);
                }
                setRightOpen((open) => !open);
              }}
            >
              {rightOpen ? "Ocultar vistas" : "Mostrar vistas"}
            </button>
            {project.protection.enabled && (
              <button
                className="workspace-button workspace-button--compact"
                onClick={async () => {
                  await flushAll();
                  onLock();
                }}
              >
                Bloquear
              </button>
            )}
            <button
              className="workspace-button workspace-button--compact"
              onClick={() => void downloadProject(repository, projectId)}
            >
              Exportar proyecto
            </button>
          </div>
        </header>
      )}

      {error && !presentation && (
        <div className="project-workspace__error" role="alert">
          <span>{error}</span>
          <button onClick={() => setError(undefined)} aria-label="Cerrar aviso">
            ×
          </button>
        </div>
      )}
      {readOnly && !presentation && (
        <div className="project-workspace__readonly" role="status">
          Este lienzo está abierto en otra pestaña. Aquí puedes consultarlo sin
          sobrescribir cambios.
        </div>
      )}

      <div className="project-workspace__body">
        {leftOpen && !presentation && (
          <aside className="canvas-sidebar" aria-label="Lienzos del proyecto">
            <div className="workspace-panel__heading">
              <div>
                <p className="workspace-eyebrow">PROYECTO</p>
                <h2>Lienzos</h2>
              </div>
              <span className="workspace-count">{canvases.length}</span>
            </div>
            <button
              className="workspace-button workspace-button--primary workspace-button--full"
              disabled={readOnly}
              onClick={async () => {
                await flushAll();
                const created = await repository.createCanvas(
                  projectId,
                  undefined,
                  projectKey,
                );
                await refreshMetadata();
                onProjectChanged();
                onNavigateCanvas(created.id);
              }}
            >
              + Nuevo lienzo
            </button>
            <div className="canvas-sidebar__list">
              {canvases.map((canvas, index) => (
                <div
                  key={canvas.id}
                  className={`canvas-list-item${
                    canvas.id === canvasId ? " is-active" : ""
                  }`}
                >
                  <button
                    className="canvas-list-item__open"
                    onClick={() => void switchCanvas(canvas.id)}
                  >
                    <span
                      className="canvas-list-item__icon"
                      aria-hidden="true"
                    />
                    <span>{canvas.name}</span>
                  </button>
                  <details className="workspace-menu workspace-menu--panel">
                    <summary aria-label={`Acciones para ${canvas.name}`}>
                      •••
                    </summary>
                    <div className="workspace-menu__items">
                      <button
                        onClick={async () => {
                          const name = window.prompt(
                            "Nombre del lienzo",
                            canvas.name,
                          );
                          if (name?.trim()) {
                            await repository.renameCanvas(
                              projectId,
                              canvas.id,
                              name,
                            );
                            await refreshMetadata();
                          }
                        }}
                      >
                        Renombrar
                      </button>
                      <button
                        disabled={readOnly}
                        onClick={async () => {
                          await flushAll();
                          const copy = await repository.duplicateCanvas(
                            projectId,
                            canvas.id,
                            projectKey,
                          );
                          await refreshMetadata();
                          onProjectChanged();
                          onNavigateCanvas(copy.id);
                        }}
                      >
                        Duplicar
                      </button>
                      <button
                        disabled={index === 0}
                        onClick={() => void moveCanvas(canvas.id, -1)}
                      >
                        Subir
                      </button>
                      <button
                        disabled={index === canvases.length - 1}
                        onClick={() => void moveCanvas(canvas.id, 1)}
                      >
                        Bajar
                      </button>
                      <button
                        className="workspace-menu__danger"
                        disabled={readOnly || canvases.length <= 1}
                        onClick={async () => {
                          if (
                            !window.confirm(
                              `¿Eliminar “${canvas.name}”? Esta acción es definitiva.`,
                            )
                          ) {
                            return;
                          }
                          await repository.deleteCanvas(projectId, canvas.id);
                          const remaining = await refreshMetadata();
                          onProjectChanged();
                          if (canvas.id === canvasId && remaining[0]) {
                            onNavigateCanvas(remaining[0].id);
                          }
                        }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </details>
                </div>
              ))}
            </div>
          </aside>
        )}

        <section
          className="project-workspace__editor"
          aria-label="Editor Excalidraw"
        >
          <EditorCanvas
            repository={repository}
            projectId={projectId}
            loadedCanvas={loadedCanvas}
            projectKey={projectKey}
            views={views}
            readOnly={readOnly}
            presentation={presentation}
            onAPI={setApi}
            onFlush={handleFlushReady}
            onStatus={handleStatus}
          />
        </section>

        {rightOpen && !presentation && (
          <aside className="views-sidebar" aria-label="Vistas guardadas">
            <div className="workspace-panel__heading">
              <div>
                <p className="workspace-eyebrow">RECORRIDO</p>
                <h2>Vistas</h2>
              </div>
              <span className="workspace-count">{views.length}</span>
            </div>
            <button
              className="workspace-button workspace-button--primary workspace-button--full"
              disabled={!api || readOnly}
              onClick={() => {
                if (!api) {
                  return;
                }
                const view = createSavedView(
                  loadedCanvas.id,
                  api.getAppState(),
                  views,
                );
                void persistViews([...views, view]);
                setSelectedViewId(view.id);
              }}
            >
              + Guardar vista actual
            </button>
            {!!views.length && (
              <button
                className="workspace-button workspace-button--full"
                onClick={() => {
                  const index = Math.max(
                    0,
                    views.findIndex((view) => view.id === selectedViewId),
                  );
                  openView(views[index], index);
                }}
              >
                ▶ Recorrer vistas
              </button>
            )}
            {!views.length ? (
              <div className="views-sidebar__empty">
                <div aria-hidden="true">⌖</div>
                <h3>Guarda un sector</h3>
                <p>
                  Conserva el encuadre y el zoom actuales para volver aquí o
                  crear una secuencia.
                </p>
              </div>
            ) : (
              <div className="views-sidebar__list">
                {views.map((view, index) => (
                  <article
                    key={view.id}
                    className={`saved-view${
                      selectedViewId === view.id ? " is-active" : ""
                    }`}
                  >
                    <button
                      className="saved-view__open"
                      onClick={() => openView(view)}
                    >
                      <span className="saved-view__number">{index + 1}</span>
                      <span className="saved-view__preview" aria-hidden="true">
                        <i />
                      </span>
                      <span className="saved-view__name">{view.name}</span>
                    </button>
                    <details className="workspace-menu workspace-menu--panel">
                      <summary aria-label={`Acciones para ${view.name}`}>
                        •••
                      </summary>
                      <div className="workspace-menu__items">
                        <button onClick={() => openView(view)}>Abrir</button>
                        <button
                          disabled={readOnly}
                          onClick={() => {
                            const name = window.prompt(
                              "Nombre de la vista",
                              view.name,
                            );
                            if (name?.trim()) {
                              void persistViews(
                                views.map((item) =>
                                  item.id === view.id
                                    ? {
                                        ...item,
                                        name: name.trim(),
                                        updatedAt: Date.now(),
                                      }
                                    : item,
                                ),
                              );
                            }
                          }}
                        >
                          Renombrar
                        </button>
                        <button
                          disabled={!api || readOnly}
                          onClick={() => {
                            if (api) {
                              void persistViews(
                                views.map((item) =>
                                  item.id === view.id
                                    ? {
                                        ...item,
                                        rect: captureVisibleRect(
                                          api.getAppState(),
                                        ),
                                        updatedAt: Date.now(),
                                      }
                                    : item,
                                ),
                              );
                            }
                          }}
                        >
                          Actualizar con vista actual
                        </button>
                        <button
                          disabled={readOnly}
                          onClick={() => {
                            const now = Date.now();
                            void persistViews([
                              ...views,
                              {
                                ...view,
                                id: globalThis.crypto.randomUUID(),
                                name: `${view.name} (copia)`,
                                order: views.length,
                                createdAt: now,
                                updatedAt: now,
                              },
                            ]);
                          }}
                        >
                          Duplicar
                        </button>
                        <button
                          disabled={index === 0 || readOnly}
                          onClick={() =>
                            void persistViews(moveSavedView(views, view.id, -1))
                          }
                        >
                          Subir
                        </button>
                        <button
                          disabled={index === views.length - 1 || readOnly}
                          onClick={() =>
                            void persistViews(moveSavedView(views, view.id, 1))
                          }
                        >
                          Bajar
                        </button>
                        <button
                          className="workspace-menu__danger"
                          disabled={readOnly}
                          onClick={() => {
                            if (
                              window.confirm(
                                `¿Eliminar la vista “${view.name}”?`,
                              )
                            ) {
                              void persistViews(
                                normalizeViewOrder(
                                  views.filter((item) => item.id !== view.id),
                                ),
                              );
                            }
                          }}
                        >
                          Eliminar
                        </button>
                      </div>
                    </details>
                  </article>
                ))}
              </div>
            )}
          </aside>
        )}
      </div>

      {presentation && presentationIndex !== null && (
        <nav
          className="presentation-controls"
          aria-label="Controles del recorrido"
        >
          <button
            className="presentation-controls__button"
            disabled={presentationIndex === 0}
            onClick={() =>
              openView(views[presentationIndex - 1], presentationIndex - 1)
            }
            aria-label="Vista anterior"
          >
            ←
          </button>
          <div>
            <strong>{views[presentationIndex]?.name}</strong>
            <span>
              {presentationIndex + 1} / {views.length}
            </span>
          </div>
          <button
            className="presentation-controls__button"
            disabled={presentationIndex === views.length - 1}
            onClick={() =>
              openView(views[presentationIndex + 1], presentationIndex + 1)
            }
            aria-label="Vista siguiente"
          >
            →
          </button>
          <button
            className="presentation-controls__exit"
            onClick={() => setPresentationIndex(null)}
          >
            Salir · Esc
          </button>
        </nav>
      )}
    </main>
  );
};
