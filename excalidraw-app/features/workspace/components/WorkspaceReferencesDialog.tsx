import { useEffect, useMemo, useState } from "react";

import { createViewThumbnail } from "../services/canvasThumbnail";

import { WorkspaceDialog } from "./WorkspaceDialog";

import type {
  CanvasSummary,
  ProjectSummary,
  SavedView,
  LoadedCanvas,
} from "../domain/types";
import type { WorkspaceReferenceTarget } from "../domain/references";
import type { WorkspaceRepository } from "../storage/WorkspaceRepository";

type CanvasPreview = CanvasSummary & { thumbnail?: string };

export const WorkspaceReferencesDialog = ({
  repository,
  currentProjectId,
  currentCanvasId,
  currentProjectKey,
  initialTarget,
  onInsert,
  onOpen,
  onClose,
}: {
  repository: WorkspaceRepository;
  currentProjectId: string;
  currentCanvasId: string;
  currentProjectKey?: CryptoKey;
  initialTarget?: WorkspaceReferenceTarget;
  onInsert?: (input: {
    target: WorkspaceReferenceTarget;
    projectName: string;
    canvasName?: string;
    viewName?: string;
    thumbnail?: string;
  }) => void;
  onOpen: (target: WorkspaceReferenceTarget) => void;
  onClose: () => void;
}) => {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [canvases, setCanvases] = useState<CanvasPreview[]>([]);
  const [views, setViews] = useState<SavedView[]>([]);
  const [previewCanvas, setPreviewCanvas] = useState<LoadedCanvas | null>(null);
  const [viewThumbnail, setViewThumbnail] = useState<string>();
  const [selectedProjectId, setSelectedProjectId] = useState(
    initialTarget?.projectId ?? currentProjectId,
  );
  const [selectedCanvasId, setSelectedCanvasId] = useState(
    initialTarget?.canvasId,
  );
  const [selectedViewId, setSelectedViewId] = useState(initialTarget?.viewId);
  const [referenceKind, setReferenceKind] = useState<"canvas" | "view">(
    initialTarget?.kind === "view" ? "view" : "canvas",
  );
  const [loading, setLoading] = useState(true);
  const [loadingViews, setLoadingViews] = useState(false);
  const [viewsLocked, setViewsLocked] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    void repository
      .listProjects()
      .then((nextProjects) => {
        if (!active) {
          return;
        }
        setProjects(nextProjects);
        if (!nextProjects.some((item) => item.id === selectedProjectId)) {
          setSelectedProjectId(nextProjects[0]?.id ?? "");
        }
      })
      .catch((loadError) =>
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudieron cargar los proyectos.",
        ),
      );
    return () => {
      active = false;
    };
  }, [repository, selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) {
      setCanvases([]);
      return;
    }
    let active = true;
    setLoading(true);
    setError(undefined);
    void repository
      .listCanvases(selectedProjectId)
      .then(async (nextCanvases) =>
        Promise.all(
          nextCanvases.map(async (canvas) => ({
            ...canvas,
            thumbnail: await repository.getCanvasThumbnail(
              selectedProjectId,
              canvas.id,
            ),
          })),
        ),
      )
      .then((nextCanvases) => {
        if (!active) {
          return;
        }
        setCanvases(nextCanvases);
        setSelectedCanvasId((current) =>
          nextCanvases.some((canvas) => canvas.id === current)
            ? current
            : nextCanvases[0]?.id,
        );
      })
      .catch((loadError) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "No se pudieron cargar los lienzos.",
          );
        }
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [repository, selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId || !selectedCanvasId) {
      setViews([]);
      setSelectedViewId(undefined);
      return;
    }
    let active = true;
    setLoadingViews(true);
    setViewsLocked(false);
    const key =
      selectedProjectId === currentProjectId ? currentProjectKey : undefined;
    void repository
      .loadCanvas(selectedProjectId, selectedCanvasId, key)
      .then((loaded) => {
        if (!active) {
          return;
        }
        const nextViews = (loaded?.payload.views ?? [])
          .slice()
          .sort((first, second) => first.order - second.order);
        setViews(nextViews);
        setPreviewCanvas(loaded);
        setSelectedViewId((current) =>
          nextViews.some((view) => view.id === current)
            ? current
            : nextViews[0]?.id,
        );
      })
      .catch(() => {
        if (active) {
          setViews([]);
          setPreviewCanvas(null);
          setSelectedViewId(undefined);
          setViewsLocked(true);
        }
      })
      .finally(() => active && setLoadingViews(false));
    return () => {
      active = false;
    };
  }, [
    currentProjectId,
    currentProjectKey,
    repository,
    selectedCanvasId,
    selectedProjectId,
  ]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId),
    [projects, selectedProjectId],
  );
  const selectedCanvas = useMemo(
    () => canvases.find((canvas) => canvas.id === selectedCanvasId),
    [canvases, selectedCanvasId],
  );
  const selectedView = useMemo(
    () => views.find((view) => view.id === selectedViewId),
    [selectedViewId, views],
  );

  useEffect(() => {
    if (!selectedView || !previewCanvas) {
      setViewThumbnail(undefined);
      return;
    }
    let active = true;
    setViewThumbnail(undefined);
    void createViewThumbnail(
      previewCanvas.payload,
      previewCanvas.files,
      selectedView,
    ).then((thumbnail) => {
      if (active) {
        setViewThumbnail(thumbnail);
      }
    });
    return () => {
      active = false;
    };
  }, [previewCanvas, selectedView]);
  const isCurrentCanvas =
    selectedProjectId === currentProjectId &&
    selectedCanvasId === currentCanvasId;
  const selectedTarget: WorkspaceReferenceTarget | undefined = selectedCanvas
    ? referenceKind === "view"
      ? selectedView
        ? {
            kind: "view",
            projectId: selectedProjectId,
            canvasId: selectedCanvas.id,
            viewId: selectedView.id,
          }
        : undefined
      : {
          kind: "canvas",
          projectId: selectedProjectId,
          canvasId: selectedCanvas.id,
        }
    : undefined;

  return (
    <WorkspaceDialog
      title={initialTarget ? "Vista previa vinculada" : "Enlazar contenido"}
      description="Referencia proyectos, lienzos o una vista concreta sin duplicarlos. Una vista abre directamente su sector, zoom y encuadre guardados."
      onClose={onClose}
      size="wide"
    >
      <div className="workspace-references">
        <aside className="workspace-references__projects">
          <p className="workspace-eyebrow">PROYECTOS</p>
          {projects.map((project) => (
            <button
              type="button"
              key={project.id}
              className={
                project.id === selectedProjectId ? "is-active" : undefined
              }
              onClick={() => {
                setSelectedProjectId(project.id);
                setSelectedCanvasId(undefined);
                setSelectedViewId(undefined);
              }}
            >
              <strong>{project.name}</strong>
              <span>
                {project.canvasCount} lienzo
                {project.canvasCount === 1 ? "" : "s"}
                {project.protection.enabled ? " · Protegido" : ""}
              </span>
            </button>
          ))}
        </aside>

        <section className="workspace-references__content">
          <div className="workspace-references__canvas-list">
            <div>
              <p className="workspace-eyebrow">LIENZOS</p>
              <strong>{selectedProject?.name ?? "Proyecto"}</strong>
            </div>
            {loading ? (
              <p className="workspace-references__empty">Cargando…</p>
            ) : (
              canvases.map((canvas) => (
                <button
                  type="button"
                  key={canvas.id}
                  className={
                    canvas.id === selectedCanvasId ? "is-active" : undefined
                  }
                  onClick={() => {
                    setSelectedCanvasId(canvas.id);
                    setSelectedViewId(undefined);
                  }}
                >
                  <span className="workspace-references__miniature">
                    {canvas.thumbnail ? (
                      <img src={canvas.thumbnail} alt="" />
                    ) : (
                      <i aria-hidden="true">⌗</i>
                    )}
                  </span>
                  <strong>{canvas.name}</strong>
                </button>
              ))
            )}
            <div className="workspace-references__target-switch" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={referenceKind === "canvas"}
                className={referenceKind === "canvas" ? "is-active" : undefined}
                onClick={() => setReferenceKind("canvas")}
              >
                Lienzo completo
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={referenceKind === "view"}
                className={referenceKind === "view" ? "is-active" : undefined}
                onClick={() => setReferenceKind("view")}
              >
                Vista guardada
              </button>
            </div>
            {referenceKind === "view" && (
              <div className="workspace-references__view-list">
                <p className="workspace-eyebrow">VISTAS DEL LIENZO</p>
                {loadingViews ? (
                  <p className="workspace-references__empty">
                    Cargando vistas…
                  </p>
                ) : viewsLocked ? (
                  <p className="workspace-references__empty">
                    Este proyecto está protegido. Ábrelo y desbloquéalo para
                    poder elegir sus vistas.
                  </p>
                ) : !views.length ? (
                  <p className="workspace-references__empty">
                    Este lienzo todavía no tiene vistas guardadas.
                  </p>
                ) : (
                  views.map((view) => (
                    <button
                      type="button"
                      key={view.id}
                      className={
                        view.id === selectedViewId ? "is-active" : undefined
                      }
                      onClick={() => setSelectedViewId(view.id)}
                    >
                      <span aria-hidden="true">⌖</span>
                      <span>
                        <strong>{view.name}</strong>
                        {view.description && <small>{view.description}</small>}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="workspace-references__preview">
            {referenceKind === "view" && viewThumbnail ? (
              <img
                src={viewThumbnail}
                alt={`Vista previa del sector ${
                  selectedView?.name ?? "guardado"
                }`}
              />
            ) : selectedCanvas?.thumbnail ? (
              <img
                src={selectedCanvas.thumbnail}
                alt={`Vista previa de ${selectedCanvas.name}`}
              />
            ) : (
              <div>
                <span aria-hidden="true">⌗</span>
                <strong>
                  {selectedProject?.protection.enabled
                    ? "Vista previa protegida"
                    : "Aún no hay miniatura"}
                </strong>
                <small>
                  Abre o guarda el lienzo para generar su vista previa.
                </small>
              </div>
            )}
            <footer>
              <div>
                <strong>
                  {referenceKind === "view"
                    ? selectedView?.name ?? "Selecciona una vista"
                    : selectedCanvas?.name ?? "Selecciona un lienzo"}
                </strong>
                <span>
                  {selectedProject?.name}
                  {referenceKind === "view" && selectedCanvas
                    ? ` · ${selectedCanvas.name}`
                    : ""}
                </span>
              </div>
              <button
                type="button"
                className="workspace-button workspace-button--primary"
                disabled={!selectedTarget}
                onClick={() => selectedTarget && onOpen(selectedTarget)}
              >
                {referenceKind === "view"
                  ? isCurrentCanvas
                    ? "Ir a esta vista"
                    : "Abrir en esta vista"
                  : isCurrentCanvas
                  ? "Lienzo actual"
                  : "Abrir lienzo"}
              </button>
            </footer>
          </div>
        </section>

        {onInsert && selectedProject && (
          <footer className="workspace-references__actions">
            <button
              type="button"
              className="workspace-button"
              disabled={!selectedCanvas}
              onClick={() =>
                onInsert({
                  target: {
                    kind: "project",
                    projectId: selectedProject.id,
                  },
                  projectName: selectedProject.name,
                  canvasName: `${selectedProject.canvasCount} lienzos`,
                  thumbnail: selectedCanvas?.thumbnail,
                })
              }
            >
              Insertar proyecto
            </button>
            <button
              type="button"
              className="workspace-button workspace-button--primary"
              disabled={
                referenceKind !== "canvas" || !selectedCanvas || isCurrentCanvas
              }
              onClick={() =>
                selectedCanvas &&
                onInsert({
                  target: {
                    kind: "canvas",
                    projectId: selectedProject.id,
                    canvasId: selectedCanvas.id,
                  },
                  projectName: selectedProject.name,
                  canvasName: selectedCanvas.name,
                  thumbnail: selectedCanvas.thumbnail,
                })
              }
            >
              Insertar lienzo
            </button>
            <button
              type="button"
              className="workspace-button workspace-button--primary"
              disabled={
                referenceKind !== "view" || !selectedCanvas || !selectedView
              }
              onClick={() =>
                selectedCanvas &&
                selectedView &&
                onInsert({
                  target: {
                    kind: "view",
                    projectId: selectedProject.id,
                    canvasId: selectedCanvas.id,
                    viewId: selectedView.id,
                  },
                  projectName: selectedProject.name,
                  canvasName: selectedCanvas.name,
                  viewName: selectedView.name,
                  thumbnail: viewThumbnail ?? selectedCanvas.thumbnail,
                })
              }
            >
              Insertar vista
            </button>
          </footer>
        )}
        {error && (
          <div className="workspace-alert workspace-alert--error">{error}</div>
        )}
      </div>
    </WorkspaceDialog>
  );
};
