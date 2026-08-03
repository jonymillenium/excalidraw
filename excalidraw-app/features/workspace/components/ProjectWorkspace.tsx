import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SyntheticEvent,
} from "react";

import {
  Excalidraw,
  MainMenu,
  TTDDialog,
  TTDDialogTrigger,
  WelcomeScreen,
} from "@excalidraw/excalidraw";
import {
  THEME,
  randomId,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";
import {
  CaptureUpdateAction,
  newElement,
  newElementWith,
  newImageElement,
  newTextElement,
} from "@excalidraw/element";
import { RequestError } from "@excalidraw/excalidraw/errors";

import type {
  ExcalidrawElement,
  FileId,
  GroupId,
  Theme,
} from "@excalidraw/element/types";
import type {
  AppState,
  BinaryFileData,
  BinaryFiles,
  DataURL,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";
import type { OrderedExcalidrawElement } from "@excalidraw/element/types";

import {
  captureVisibleRect,
  createSavedView,
  moveSavedViewWithinFolder,
  normalizeViewOrder,
} from "../domain/views";
import { getInitialEditorAppState } from "../domain/editorFeatures";
import {
  DEFAULT_CANVAS_BACKGROUND_COLOR,
  DEFAULT_CANVAS_ELEMENT_COLOR,
  normalizeCanvasColorProfiles,
} from "../domain/canvasColors";
import {
  createWorkspaceReferenceLink,
  getSelectedWorkspaceReferenceTarget,
  parseWorkspaceReferenceLink,
  type WorkspaceReferenceTarget,
} from "../domain/references";
import { TTDIndexedDBAdapter } from "../../../data/TTDStorage";

import { useAutosaveCanvas, type SaveStatus } from "../hooks/useAutosaveCanvas";
import {
  exportCanvas,
  type CanvasExportFormat,
} from "../services/canvasExport";
import { CanvasLease } from "../services/canvasLease";
import { downloadProject } from "../services/projectTransfer";
import { generateMermaidWithOpenRouter } from "../services/openRouter";

import { SavedViewDialog } from "./SavedViewDialog";
import { CanvasColorProfilesDialog } from "./CanvasColorProfilesDialog";
import { OpenRouterDialog } from "./OpenRouterDialog";
import { WorkspaceReferencesDialog } from "./WorkspaceReferencesDialog";
import { useWorkspacePrompts } from "./WorkspacePromptDialog";

import type {
  CanvasSummary,
  CanvasColorProfile,
  LoadedCanvas,
  ProfileProtection,
  ProjectDetails,
  SavedView,
} from "../domain/types";

import type { WorkspaceRepository } from "../storage/WorkspaceRepository";

const folderPathKey = (path: readonly string[]) => path.join("\u001f");

const sameFolderPath = (
  first: readonly string[] | undefined,
  second: readonly string[],
) => folderPathKey(first ?? []) === folderPathKey(second);

const normalizeFolderPath = (value: string) =>
  value
    .split(/[\\/]+/)
    .map((part) => part.trim().replace(/\s+/g, " ").slice(0, 80))
    .filter(Boolean);

const withFolderPrefixes = (folders: string[][], path: string[]) => {
  const next = new Map(
    folders.map((folder) => [folderPathKey(folder), folder]),
  );
  for (let depth = 1; depth <= path.length; depth++) {
    const prefix = path.slice(0, depth);
    next.set(folderPathKey(prefix), prefix);
  }
  return [...next.values()];
};

type WorkspaceToolbarIconName =
  | "canvases"
  | "views"
  | "create"
  | "present"
  | "export"
  | "more";

const WorkspaceToolbarIcon = ({ name }: { name: WorkspaceToolbarIconName }) => {
  if (name === "canvases" || name === "views") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path d={name === "canvases" ? "M9 3v18" : "M15 3v18"} />
      </svg>
    );
  }
  if (name === "create") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 4v16M4 12h16" />
      </svg>
    );
  }
  if (name === "present") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="m9 6 9 6-9 6V6Z" />
      </svg>
    );
  }
  if (name === "export") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 15V3m0 0L7 8m5-5 5 5M5 13v7h14v-7" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="5" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="19" cy="12" r="1.4" />
    </svg>
  );
};

const WorkspaceLibraryIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <rect x="3" y="4" width="8" height="7" rx="1.5" />
    <rect x="13" y="4" width="8" height="7" rx="1.5" />
    <rect x="3" y="13" width="8" height="7" rx="1.5" />
    <path d="M15 16.5h4M17 14.5v4" />
  </svg>
);

const keepOnlyCurrentToolbarMenuOpen = (
  event: SyntheticEvent<HTMLDetailsElement>,
) => {
  const current = event.currentTarget;
  if (!current.open) {
    return;
  }
  current.parentElement
    ?.querySelectorAll<HTMLDetailsElement>("details[open]")
    .forEach((menu) => {
      if (menu !== current) {
        menu.removeAttribute("open");
      }
    });
};

const EditorCanvas = ({
  repository,
  projectId,
  loadedCanvas,
  projectKey,
  profileId,
  profileKey,
  views,
  viewFolders,
  colorProfiles,
  readOnly,
  presentation,
  onAPI,
  onFlush,
  onStatus,
  onOpenReference,
  onBrowseReferences,
}: {
  repository: WorkspaceRepository;
  projectId: string;
  loadedCanvas: LoadedCanvas;
  projectKey?: CryptoKey;
  profileId: string;
  profileKey?: CryptoKey;
  views: SavedView[];
  viewFolders: string[][];
  colorProfiles: Array<CanvasColorProfile | null>;
  readOnly: boolean;
  presentation: boolean;
  onAPI: (api: ExcalidrawImperativeAPI | null) => void;
  onFlush: (flush: () => Promise<void>) => void;
  onStatus: (status: SaveStatus, error?: Error) => void;
  onOpenReference: (target: WorkspaceReferenceTarget) => void;
  onBrowseReferences: () => void;
}) => {
  const [editorApi, setEditorApi] = useState<ExcalidrawImperativeAPI | null>(
    null,
  );
  const [sketchElementIds, setSketchElementIds] = useState<string[]>([]);
  const knownElementIdsRef = useRef(
    new Set(loadedCanvas.payload.elements.map((element) => element.id)),
  );
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
    viewFolders,
    colorProfiles,
    disabled: readOnly,
    onStatusChange: onStatus,
  });

  useEffect(() => {
    onFlush(flush);
  }, [flush, onFlush]);

  useEffect(() => {
    knownElementIdsRef.current = new Set(
      loadedCanvas.payload.elements.map((element) => element.id),
    );
    setSketchElementIds([]);
  }, [loadedCanvas.id, loadedCanvas.payload.elements]);

  useEffect(() => {
    if (!editorApi || presentation) {
      return;
    }

    const handleQuickLook = (event: KeyboardEvent) => {
      if (
        (event.code !== "Space" && event.key !== " ") ||
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey ||
        document.querySelector(".workspace-dialog[aria-modal='true']")
      ) {
        return;
      }

      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          "input, textarea, select, button, [contenteditable='true'], [data-type='wysiwyg'], .cm-editor",
        )
      ) {
        return;
      }

      const appState = editorApi.getAppState();
      if (appState.editingTextElement) {
        return;
      }
      const reference = getSelectedWorkspaceReferenceTarget(
        editorApi.getSceneElementsIncludingDeleted(),
        appState.selectedElementIds,
      );
      if (!reference) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      onOpenReference(reference);
    };

    window.addEventListener("keydown", handleQuickLook, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleQuickLook, {
        capture: true,
      });
  }, [editorApi, onOpenReference, presentation]);

  const handleSceneChange = useCallback(
    (
      elements: readonly OrderedExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles,
    ) => {
      schedule(elements, appState, files);
      if (readOnly || presentation) {
        return;
      }
      const newFreedrawIds: string[] = [];
      for (const element of elements) {
        if (
          !knownElementIdsRef.current.has(element.id) &&
          !element.isDeleted &&
          element.type === "freedraw"
        ) {
          newFreedrawIds.push(element.id);
        }
        knownElementIdsRef.current.add(element.id);
      }
      if (newFreedrawIds.length) {
        setSketchElementIds((current) => [
          ...new Set([...current, ...newFreedrawIds]),
        ]);
      }
    },
    [presentation, readOnly, schedule],
  );

  const finishSketch = useCallback(
    (asGroup: boolean) => {
      if (!editorApi || !sketchElementIds.length) {
        return;
      }
      const sketchIds = new Set(sketchElementIds);
      const groupId = asGroup ? randomId() : null;
      const elements = editorApi
        .getSceneElementsIncludingDeleted()
        .map((element) =>
          groupId && sketchIds.has(element.id)
            ? newElementWith(element, {
                groupIds: [...element.groupIds, groupId],
              })
            : element,
        );
      const selectedElementIds = Object.fromEntries(
        sketchElementIds.map((id) => [id, true as const]),
      );
      editorApi.updateScene({
        elements,
        appState: {
          ...editorApi.getAppState(),
          selectedElementIds,
          selectedGroupIds: groupId ? { [groupId]: true } : {},
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      editorApi.setActiveTool({ type: "selection" });
      setSketchElementIds([]);
    },
    [editorApi, sketchElementIds],
  );

  return (
    <div className="editor-canvas-shell">
      <Excalidraw
        key={loadedCanvas.id}
        name={loadedCanvas.name}
        initialData={{
          elements: loadedCanvas.payload.elements,
          appState: getInitialEditorAppState(loadedCanvas.payload),
          files: loadedCanvas.files,
        }}
        onChange={handleSceneChange}
        onExcalidrawAPI={(nextApi) => {
          setEditorApi(nextApi);
          onAPI(nextApi);
        }}
        viewModeEnabled={presentation || readOnly}
        zenModeEnabled={presentation}
        activeTool={presentation ? { type: "laser" } : undefined}
        interaction={
          presentation
            ? {
                enabled: {
                  links: true,
                  navigation: true,
                  tools: { laser: true },
                },
              }
            : !readOnly
        }
        theme={theme}
        onThemeChange={setThemePreference}
        toolbarActions={
          presentation
            ? undefined
            : [
                {
                  id: "workspace-library",
                  label: "Biblioteca de proyectos, lienzos y vistas",
                  icon: <WorkspaceLibraryIcon />,
                  onSelect: () => onBrowseReferences(),
                  disabled: readOnly,
                },
              ]
        }
        onLinkOpen={(element, event) => {
          const reference = parseWorkspaceReferenceLink(element.link);
          if (reference) {
            event.preventDefault();
            onOpenReference(reference);
          }
        }}
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
            <MainMenu.DefaultItems.Preferences />
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
        {!presentation && (
          <>
            <TTDDialogTrigger />
            <TTDDialog
              persistenceAdapter={TTDIndexedDBAdapter}
              onTextSubmit={async ({ messages, onChunk, onStreamCreated }) => {
                if (!profileKey) {
                  return {
                    generatedResponse: null,
                    error: new RequestError({
                      message:
                        "Desbloquea el perfil y configura OpenRouter para generar diagramas.",
                      status: 401,
                    }),
                  };
                }
                try {
                  onStreamCreated?.();
                  const generatedResponse = await generateMermaidWithOpenRouter(
                    {
                      repository,
                      profileId,
                      profileKey,
                      messages,
                    },
                  );
                  onChunk?.(generatedResponse);
                  return { generatedResponse, error: null };
                } catch (generationError) {
                  return {
                    generatedResponse: null,
                    error: new RequestError({
                      message:
                        generationError instanceof Error
                          ? generationError.message
                          : "No se pudo generar el diagrama.",
                      status: 500,
                    }),
                  };
                }
              }}
            />
          </>
        )}
      </Excalidraw>
      {!!sketchElementIds.length && !presentation && (
        <div className="sketch-finish-bar" role="status">
          <div>
            <strong>Sketch en curso</strong>
            <span>
              {sketchElementIds.length}{" "}
              {sketchElementIds.length === 1 ? "trazo" : "trazos"}
            </span>
          </div>
          <button type="button" onClick={() => finishSketch(false)}>
            Dejar individuales
          </button>
          <button
            type="button"
            className="sketch-finish-bar__primary"
            onClick={() => finishSketch(true)}
          >
            Guardar como grupo
          </button>
        </div>
      )}
    </div>
  );
};

export const ProjectWorkspace = ({
  repository,
  projectId,
  canvasId,
  targetViewId,
  projectKey,
  profileId,
  profileName,
  profileProtection,
  profileKey,
  onVerifyProfilePassword,
  onBack,
  onNavigateCanvas,
  onNavigateReference,
  onLock,
  onProjectChanged,
}: {
  repository: WorkspaceRepository;
  projectId: string;
  canvasId: string;
  targetViewId?: string;
  projectKey?: CryptoKey;
  profileId: string;
  profileName: string;
  profileProtection: ProfileProtection;
  profileKey?: CryptoKey;
  onVerifyProfilePassword: (password: string) => Promise<CryptoKey>;
  onBack: () => void;
  onNavigateCanvas: (canvasId: string) => void;
  onNavigateReference: (
    projectId: string,
    canvasId: string,
    viewId?: string,
  ) => void;
  onLock: () => void;
  onProjectChanged: () => void;
}) => {
  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [canvases, setCanvases] = useState<CanvasSummary[]>([]);
  const [loadedCanvas, setLoadedCanvas] = useState<LoadedCanvas | null>(null);
  const [views, setViews] = useState<SavedView[]>([]);
  const [viewFolders, setViewFolders] = useState<string[][]>([]);
  const [activeViewFolderPath, setActiveViewFolderPath] = useState<string[]>(
    [],
  );
  const [colorProfiles, setColorProfiles] = useState<
    Array<CanvasColorProfile | null>
  >(() => normalizeCanvasColorProfiles());
  const [showColorProfiles, setShowColorProfiles] = useState(false);
  const [showOpenRouter, setShowOpenRouter] = useState(false);
  const [referenceDialog, setReferenceDialog] = useState<
    | { mode: "browse" }
    | { mode: "preview"; target: WorkspaceReferenceTarget }
    | null
  >(null);
  const [activeProfileKey, setActiveProfileKey] = useState(profileKey);
  const [selectedViewId, setSelectedViewId] = useState<string>();
  const [viewDialog, setViewDialog] = useState<
    { mode: "create" } | { mode: "edit"; view: SavedView } | null
  >(null);
  const [presentationIndex, setPresentationIndex] = useState<number | null>(
    null,
  );
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(false);
  const [isExportingProject, setIsExportingProject] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [error, setError] = useState<string>();
  const [readOnly, setReadOnly] = useState(false);
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const { askText, askConfirm, promptDialog } = useWorkspacePrompts();
  const flushRef = useRef<() => Promise<void>>(async () => undefined);
  const criticalSaveRef = useRef<Promise<void>>(Promise.resolve());
  const leaseRef = useRef(new CanvasLease());
  const openedTargetViewRef = useRef<string | undefined>(undefined);
  const toolbarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setActiveProfileKey(profileKey), [profileKey]);

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

  useEffect(() => {
    const closeToolbarMenus = (restoreFocus = false) => {
      toolbarRef.current
        ?.querySelectorAll<HTMLDetailsElement>("details[open]")
        .forEach((menu) => {
          menu.removeAttribute("open");
          if (restoreFocus) {
            menu.querySelector<HTMLElement>("summary")?.focus();
          }
        });
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (
        toolbarRef.current &&
        event.target instanceof Node &&
        !toolbarRef.current.contains(event.target)
      ) {
        closeToolbarMenus();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeToolbarMenus(true);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
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
          setViewFolders(nextCanvas.payload.viewFolders ?? []);
          setActiveViewFolderPath([]);
          setColorProfiles(
            normalizeCanvasColorProfiles(nextCanvas.payload.colorProfiles),
          );
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
    async (nextViews: SavedView[], nextViewFolders = viewFolders) => {
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
            ...loadedCanvas.payload,
            elements: api.getSceneElementsIncludingDeleted(),
            appState: api.getAppState(),
            fileIds: Object.keys(
              api.getFiles(),
            ) as LoadedCanvas["payload"]["fileIds"],
            views: nextViews,
            viewFolders: nextViewFolders,
            colorProfiles,
          },
          api.getFiles(),
          projectKey,
        );
        setViews(nextViews);
        setViewFolders(nextViewFolders);
        setLoadedCanvas((current) =>
          current
            ? {
                ...current,
                payload: {
                  ...current.payload,
                  views: nextViews,
                  viewFolders: nextViewFolders,
                },
              }
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
    [
      api,
      colorProfiles,
      loadedCanvas,
      projectId,
      projectKey,
      readOnly,
      repository,
      viewFolders,
    ],
  );

  const persistColorProfiles = useCallback(
    async (
      nextProfiles: Array<CanvasColorProfile | null>,
      profileToApply?: CanvasColorProfile,
      applyToExistingElements = false,
      restoreFactoryStyle = false,
    ) => {
      if (!api || !loadedCanvas || readOnly) {
        return;
      }
      const normalizedProfiles = normalizeCanvasColorProfiles(nextProfiles);
      const appState = restoreFactoryStyle
        ? {
            ...api.getAppState(),
            viewBackgroundColor: DEFAULT_CANVAS_BACKGROUND_COLOR,
            viewBackgroundColorMode: "theme" as const,
            currentItemStrokeColor: DEFAULT_CANVAS_ELEMENT_COLOR,
            currentItemBackgroundColor: "transparent",
          }
        : profileToApply
        ? {
            ...api.getAppState(),
            viewBackgroundColor: profileToApply.backgroundColor,
            viewBackgroundColorMode: "exact" as const,
            currentItemStrokeColor: profileToApply.elementColor,
          }
        : api.getAppState();
      const elements =
        profileToApply && applyToExistingElements
          ? api.getSceneElementsIncludingDeleted().map((element) =>
              "strokeColor" in element
                ? newElementWith(element, {
                    strokeColor: profileToApply.elementColor,
                  })
                : element,
            )
          : api.getSceneElementsIncludingDeleted();

      if (profileToApply || restoreFactoryStyle) {
        api.updateScene({
          elements,
          appState,
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
      }

      const previousSave = criticalSaveRef.current;
      const operation = previousSave.then(async () => {
        await flushRef.current();
        setSaveStatus("saving");
        await repository.saveCanvas(
          projectId,
          loadedCanvas.id,
          {
            ...loadedCanvas.payload,
            elements,
            appState,
            fileIds: Object.keys(
              api.getFiles(),
            ) as LoadedCanvas["payload"]["fileIds"],
            views,
            viewFolders,
            colorProfiles: normalizedProfiles,
          },
          api.getFiles(),
          projectKey,
        );
        setColorProfiles(normalizedProfiles);
        setLoadedCanvas((current) =>
          current
            ? {
                ...current,
                payload: {
                  ...current.payload,
                  appState,
                  colorProfiles: normalizedProfiles,
                },
              }
            : current,
        );
        setSaveStatus("saved");
      });
      criticalSaveRef.current = operation.catch(() => undefined);
      await operation;
    },
    [
      api,
      loadedCanvas,
      projectId,
      projectKey,
      readOnly,
      repository,
      viewFolders,
      views,
    ],
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
    if (!targetViewId) {
      openedTargetViewRef.current = undefined;
      return;
    }
    if (!api || openedTargetViewRef.current === targetViewId) {
      return;
    }
    const target = views.find((view) => view.id === targetViewId);
    if (!target) {
      setError("La vista vinculada ya no existe en este lienzo.");
      openedTargetViewRef.current = targetViewId;
      return;
    }
    openedTargetViewRef.current = targetViewId;
    openView(target);
  }, [api, openView, targetViewId, views]);

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

  const createNewCanvas = async () => {
    const name = await askText({
      title: "Crear nuevo lienzo",
      description:
        "Ponle un nombre para encontrarlo rápido. Si todavía no definiste la idea, puedes dejarlo como “Lienzo sin nombre” y renombrarlo después.",
      label: "Nombre del lienzo",
      placeholder: "Ej. Flujo de onboarding",
      confirmLabel: "Crear lienzo",
      secondaryLabel: "Crear como “Lienzo sin nombre”",
      secondaryValue: "Lienzo sin nombre",
      maxLength: 120,
    });
    if (name === null) {
      return;
    }
    try {
      await flushAll();
      const created = await repository.createCanvas(
        projectId,
        name.trim(),
        projectKey,
      );
      await refreshMetadata();
      onProjectChanged();
      onNavigateCanvas(created.id);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "No se pudo crear el lienzo.",
      );
    }
  };

  const renameWorkspaceCanvas = async (canvas: CanvasSummary) => {
    if (readOnly) {
      return;
    }
    const name = await askText({
      title: "Renombrar lienzo",
      description:
        "El nuevo nombre se reflejará en el proyecto y en sus referencias.",
      label: "Nombre del lienzo",
      initialValue: canvas.name,
      confirmLabel: "Guardar nombre",
      maxLength: 120,
    });
    const nextName = name?.trim();
    if (!nextName || nextName === canvas.name) {
      return;
    }
    try {
      await repository.renameCanvas(projectId, canvas.id, nextName);
      await refreshMetadata();
      if (canvas.id === canvasId) {
        setLoadedCanvas((current) =>
          current ? { ...current, name: nextName } : current,
        );
      }
      onProjectChanged();
    } catch (renameError) {
      setError(
        renameError instanceof Error
          ? renameError.message
          : "No se pudo renombrar el lienzo.",
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

  const insertWorkspaceReference = ({
    target,
    projectName,
    canvasName,
    viewName,
    thumbnail,
  }: {
    target: WorkspaceReferenceTarget;
    projectName: string;
    canvasName?: string;
    viewName?: string;
    thumbnail?: string;
  }) => {
    if (!api || readOnly) {
      return;
    }
    const appState = api.getAppState();
    const center = viewportCoordsToSceneCoords(
      { clientX: appState.width / 2, clientY: appState.height / 2 },
      appState,
    );
    const width = 360;
    const height = 220;
    const x = center.x - width / 2;
    const y = center.y - height / 2;
    const groupId = randomId() as GroupId;
    const link = createWorkspaceReferenceLink(target);
    const common = {
      groupIds: [groupId],
      link,
      customData: { workspaceReference: target },
    };
    const card = newElement({
      type: "rectangle",
      x,
      y,
      width,
      height,
      strokeColor: "#ffd43b",
      backgroundColor: "#19191f",
      fillStyle: "solid",
      strokeWidth: 2,
      roughness: 0,
      roundness: { type: 3 },
      ...common,
    });
    const elements: ExcalidrawElement[] = [card];
    if (thumbnail) {
      const fileId = randomId() as FileId;
      api.addFiles([
        {
          id: fileId,
          dataURL: thumbnail as DataURL,
          mimeType: (thumbnail.match(/^data:([^;]+)/)?.[1] ??
            "image/webp") as BinaryFileData["mimeType"],
          created: Date.now(),
        },
      ]);
      elements.push(
        newImageElement({
          type: "image",
          x: x + 8,
          y: y + 8,
          width: width - 16,
          height: 146,
          fileId,
          status: "saved",
          roundness: { type: 3 },
          ...common,
        }),
      );
    }
    elements.push(
      newTextElement({
        x: x + 18,
        y: y + 168,
        text:
          target.kind === "project"
            ? projectName
            : target.kind === "view"
            ? viewName ?? "Vista"
            : canvasName ?? "Lienzo",
        fontSize: 20,
        strokeColor: "#ffffff",
        ...common,
      }),
      newTextElement({
        x: x + 18,
        y: y + 198,
        text:
          target.kind === "project"
            ? canvasName ?? "Proyecto vinculado"
            : target.kind === "view"
            ? `${projectName} · ${canvasName ?? "Lienzo"}`
            : projectName,
        fontSize: 12,
        strokeColor: "#a7a7b5",
        ...common,
      }),
    );
    api.updateScene({
      elements: [...api.getSceneElementsIncludingDeleted(), ...elements],
      appState: {
        ...appState,
        selectedElementIds: Object.fromEntries(
          elements.map((element) => [element.id, true]),
        ),
        selectedGroupIds: { [groupId]: true },
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    api.setActiveTool({ type: "selection" });
    setReferenceDialog(null);
  };

  const handleCanvasExport = async (format: CanvasExportFormat) => {
    if (!api) {
      return;
    }
    try {
      await exportCanvas(api, loadedCanvas?.name ?? "lienzo", format);
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "No se pudo exportar el lienzo.",
      );
    }
  };

  const handleProjectExport = async () => {
    if (isExportingProject) {
      return;
    }
    setIsExportingProject(true);
    setError(undefined);
    try {
      await flushAll();
      await downloadProject(repository, projectId);
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "No se pudo exportar el proyecto.",
      );
    } finally {
      setIsExportingProject(false);
    }
  };

  const startPresentation = () => {
    const index = Math.max(
      0,
      views.findIndex((view) => view.id === selectedViewId),
    );
    if (views[index]) {
      openView(views[index], index);
    }
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
  const availableViewFolders = (() => {
    let folders = viewFolders;
    for (const view of views) {
      if (view.folderPath?.length) {
        folders = withFolderPrefixes(folders, view.folderPath);
      }
    }
    return folders;
  })();
  const childViewFolders = [
    ...new Set(
      availableViewFolders.flatMap((path) =>
        path.length > activeViewFolderPath.length &&
        activeViewFolderPath.every((part, index) => path[index] === part)
          ? [path[activeViewFolderPath.length]]
          : [],
      ),
    ),
  ].sort((first, second) => first.localeCompare(second));
  const visibleViews = views.filter((view) =>
    sameFolderPath(view.folderPath, activeViewFolderPath),
  );

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
            <button
              className="project-toolbar-button project-toolbar-button--icon"
              type="button"
              onClick={() => {
                if (!leftOpen) {
                  setRightOpen(false);
                }
                setLeftOpen((open) => !open);
              }}
              aria-label={leftOpen ? "Ocultar lienzos" : "Mostrar lienzos"}
              aria-controls="canvas-sidebar"
              aria-expanded={leftOpen}
              title={leftOpen ? "Ocultar lienzos" : "Mostrar lienzos"}
            >
              <WorkspaceToolbarIcon name="canvases" />
            </button>
            <div className="project-workspace__identity">
              <div className="project-workspace__path">
                <strong>{project.name}</strong>
                <span aria-hidden="true">/</span>
                <button
                  type="button"
                  className="project-workspace__canvas-name"
                  disabled={readOnly}
                  onDoubleClick={() => void renameWorkspaceCanvas(loadedCanvas)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === "F2") {
                      event.preventDefault();
                      void renameWorkspaceCanvas(loadedCanvas);
                    }
                  }}
                  aria-label={`Renombrar lienzo ${loadedCanvas.name}`}
                  title="Doble clic para renombrar"
                >
                  {loadedCanvas.name}
                </button>
              </div>
              <div className="project-workspace__status" role="status">
                <span className={`save-status save-status--${saveStatus}`}>
                  {saveStatus === "saving"
                    ? "Guardando…"
                    : saveStatus === "error"
                    ? "Error al guardar"
                    : "Guardado"}
                </span>
                {readOnly && (
                  <span className="workspace-badge">Solo lectura</span>
                )}
              </div>
            </div>
          </div>
          <div
            ref={toolbarRef}
            className="project-workspace__actions"
            role="toolbar"
            aria-label="Herramientas del proyecto"
          >
            <details
              className="workspace-menu workspace-menu--topbar"
              onToggle={keepOnlyCurrentToolbarMenuOpen}
            >
              <summary
                className="project-toolbar-button"
                role="button"
                aria-label="Crear"
                aria-haspopup="menu"
                title="Crear"
              >
                <WorkspaceToolbarIcon name="create" />
                <span className="project-toolbar-button__label">Crear</span>
              </summary>
              <div className="workspace-menu__items" role="menu">
                <span className="workspace-menu__label">CREAR</span>
                <button
                  role="menuitem"
                  disabled={readOnly}
                  onClick={(event) => {
                    event.currentTarget
                      .closest("details")
                      ?.removeAttribute("open");
                    setShowOpenRouter(true);
                  }}
                >
                  <strong>Crear con IA</strong>
                  <small>Texto, archivos y contenido multimodal</small>
                </button>
                <button
                  role="menuitem"
                  disabled={readOnly}
                  onClick={(event) => {
                    event.currentTarget
                      .closest("details")
                      ?.removeAttribute("open");
                    void createNewCanvas();
                  }}
                >
                  <strong>Nuevo lienzo</strong>
                  <small>Añadir otro espacio a este proyecto</small>
                </button>
              </div>
            </details>
            <button
              className="project-toolbar-button project-toolbar-button--present"
              type="button"
              disabled={!api || !views.length}
              onClick={startPresentation}
              title={
                views.length
                  ? "Presentar recorrido de vistas"
                  : "Guarda una vista para poder presentar"
              }
            >
              <WorkspaceToolbarIcon name="present" />
              <span className="project-toolbar-button__label">Presentar</span>
            </button>
            <details
              className="workspace-menu workspace-menu--topbar workspace-menu--export"
              onToggle={keepOnlyCurrentToolbarMenuOpen}
            >
              <summary
                className="project-toolbar-button"
                role="button"
                aria-label="Exportar"
                aria-haspopup="menu"
                title="Exportar"
              >
                <WorkspaceToolbarIcon name="export" />
                <span className="project-toolbar-button__label">Exportar</span>
              </summary>
              <div className="workspace-menu__items" role="menu">
                <span className="workspace-menu__label">LIENZO ACTUAL</span>
                <button
                  role="menuitem"
                  disabled={!api}
                  onClick={(event) => {
                    event.currentTarget
                      .closest("details")
                      ?.removeAttribute("open");
                    void handleCanvasExport("png");
                  }}
                >
                  Imagen PNG
                </button>
                <button
                  role="menuitem"
                  disabled={!api}
                  onClick={(event) => {
                    event.currentTarget
                      .closest("details")
                      ?.removeAttribute("open");
                    void handleCanvasExport("jpg");
                  }}
                >
                  Imagen JPG
                </button>
                <button
                  role="menuitem"
                  disabled={!api}
                  onClick={(event) => {
                    event.currentTarget
                      .closest("details")
                      ?.removeAttribute("open");
                    void handleCanvasExport("svg");
                  }}
                >
                  Vector SVG
                </button>
                <button
                  role="menuitem"
                  disabled={!api}
                  onClick={(event) => {
                    event.currentTarget
                      .closest("details")
                      ?.removeAttribute("open");
                    void handleCanvasExport("excalidraw");
                  }}
                >
                  Archivo .excalidraw
                </button>
                <div className="workspace-menu__separator" />
                <span className="workspace-menu__label">PROYECTO COMPLETO</span>
                <button
                  role="menuitem"
                  disabled={isExportingProject}
                  onClick={(event) => {
                    event.currentTarget
                      .closest("details")
                      ?.removeAttribute("open");
                    void handleProjectExport();
                  }}
                >
                  <strong>
                    {isExportingProject
                      ? "Preparando proyecto…"
                      : "Backup del proyecto"}
                  </strong>
                  <small>Incluye todos sus lienzos, vistas y archivos</small>
                </button>
              </div>
            </details>
            <button
              className="project-toolbar-button project-toolbar-button--icon"
              type="button"
              onClick={() => {
                if (!rightOpen) {
                  setLeftOpen(false);
                }
                setRightOpen((open) => !open);
              }}
              aria-label={rightOpen ? "Ocultar vistas" : "Mostrar vistas"}
              aria-controls="views-sidebar"
              aria-expanded={rightOpen}
              title={rightOpen ? "Ocultar vistas" : "Mostrar vistas"}
            >
              <WorkspaceToolbarIcon name="views" />
            </button>
            <details
              className="workspace-menu workspace-menu--topbar"
              onToggle={keepOnlyCurrentToolbarMenuOpen}
            >
              <summary
                className="project-toolbar-button project-toolbar-button--icon"
                role="button"
                aria-label="Más opciones"
                aria-haspopup="menu"
                title="Más opciones"
              >
                <WorkspaceToolbarIcon name="more" />
              </summary>
              <div className="workspace-menu__items" role="menu">
                <span className="workspace-menu__label">LIENZO</span>
                <button
                  role="menuitem"
                  disabled={readOnly}
                  onClick={(event) => {
                    event.currentTarget
                      .closest("details")
                      ?.removeAttribute("open");
                    setShowColorProfiles(true);
                  }}
                >
                  <strong>Apariencia del lienzo</strong>
                  <small>Perfiles de color y estilo original</small>
                </button>
                {project.protection.enabled && (
                  <>
                    <div className="workspace-menu__separator" />
                    <span className="workspace-menu__label">SEGURIDAD</span>
                    <button
                      role="menuitem"
                      onClick={async (event) => {
                        event.currentTarget
                          .closest("details")
                          ?.removeAttribute("open");
                        await flushAll();
                        onLock();
                      }}
                    >
                      Bloquear proyecto
                    </button>
                  </>
                )}
              </div>
            </details>
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
          <aside
            id="canvas-sidebar"
            className="canvas-sidebar"
            aria-label="Lienzos del proyecto"
          >
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
              onClick={() => void createNewCanvas()}
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
                        onClick={() => void renameWorkspaceCanvas(canvas)}
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
                          const confirmed = await askConfirm({
                            title: `Eliminar “${canvas.name}”`,
                            description:
                              "Se eliminarán el lienzo, sus vistas y sus archivos locales. Esta acción no se puede deshacer.",
                            confirmLabel: "Eliminar lienzo",
                            destructive: true,
                          });
                          if (!confirmed) {
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
            profileId={profileId}
            profileKey={activeProfileKey}
            views={views}
            viewFolders={viewFolders}
            colorProfiles={colorProfiles}
            readOnly={readOnly}
            presentation={presentation}
            onAPI={setApi}
            onFlush={handleFlushReady}
            onStatus={handleStatus}
            onOpenReference={(target) =>
              setReferenceDialog({ mode: "preview", target })
            }
            onBrowseReferences={() => setReferenceDialog({ mode: "browse" })}
          />
        </section>

        {rightOpen && !presentation && (
          <aside
            id="views-sidebar"
            className="views-sidebar"
            aria-label="Vistas guardadas"
          >
            <div className="workspace-panel__heading">
              <div>
                <p className="workspace-eyebrow">RECORRIDO</p>
                <h2>Vistas</h2>
              </div>
              <span className="workspace-count">{views.length}</span>
            </div>
            <div className="view-folder-toolbar">
              <div className="view-folder-breadcrumbs">
                <button onClick={() => setActiveViewFolderPath([])}>
                  Vistas
                </button>
                {activeViewFolderPath.map((folder, index) => (
                  <span
                    key={folderPathKey(
                      activeViewFolderPath.slice(0, index + 1),
                    )}
                  >
                    <i>/</i>
                    <button
                      onClick={() =>
                        setActiveViewFolderPath(
                          activeViewFolderPath.slice(0, index + 1),
                        )
                      }
                    >
                      {folder}
                    </button>
                  </span>
                ))}
              </div>
              <button
                className="workspace-button workspace-button--compact"
                disabled={readOnly}
                onClick={async () => {
                  const name = await askText({
                    title: "Nueva carpeta de vistas",
                    description:
                      "La carpeta se creará dentro de la ubicación que estás viendo.",
                    label: "Nombre de la carpeta",
                    placeholder: "Ej. Presentación final",
                    confirmLabel: "Crear carpeta",
                    maxLength: 80,
                  });
                  const part = name ? normalizeFolderPath(name)[0] : undefined;
                  if (!part) {
                    return;
                  }
                  const path = [...activeViewFolderPath, part];
                  void persistViews(
                    views,
                    withFolderPrefixes(viewFolders, path),
                  ).then(() => setActiveViewFolderPath(path));
                }}
              >
                + Carpeta
              </button>
            </div>
            {!!childViewFolders.length && (
              <div className="view-folder-list">
                {childViewFolders.map((folder) => (
                  <button
                    key={folder}
                    onClick={() =>
                      setActiveViewFolderPath([...activeViewFolderPath, folder])
                    }
                  >
                    <span aria-hidden="true">▰</span>
                    <strong>{folder}</strong>
                  </button>
                ))}
              </div>
            )}
            <button
              className="workspace-button workspace-button--primary workspace-button--full"
              disabled={!api || readOnly}
              onClick={() => setViewDialog({ mode: "create" })}
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
            {!visibleViews.length && !childViewFolders.length ? (
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
                {visibleViews.map((view, index) => (
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
                      <span className="saved-view__meta">
                        <strong className="saved-view__name">
                          {view.name}
                        </strong>
                        {view.description && <small>{view.description}</small>}
                      </span>
                    </button>
                    <div
                      className="saved-view__order"
                      aria-label={`Ordenar ${view.name}`}
                    >
                      <button
                        disabled={index === 0 || readOnly}
                        onClick={() =>
                          void persistViews(
                            moveSavedViewWithinFolder(
                              views,
                              view.id,
                              -1,
                              activeViewFolderPath,
                            ),
                          )
                        }
                        aria-label={`Subir ${view.name}`}
                        title="Subir"
                      >
                        ↑
                      </button>
                      <button
                        disabled={index === visibleViews.length - 1 || readOnly}
                        onClick={() =>
                          void persistViews(
                            moveSavedViewWithinFolder(
                              views,
                              view.id,
                              1,
                              activeViewFolderPath,
                            ),
                          )
                        }
                        aria-label={`Bajar ${view.name}`}
                        title="Bajar"
                      >
                        ↓
                      </button>
                    </div>
                    <details className="workspace-menu workspace-menu--panel">
                      <summary aria-label={`Acciones para ${view.name}`}>
                        •••
                      </summary>
                      <div className="workspace-menu__items">
                        <button onClick={() => openView(view)}>Abrir</button>
                        <button
                          disabled={readOnly}
                          onClick={() => setViewDialog({ mode: "edit", view })}
                        >
                          Editar nombre y descripción
                        </button>
                        <button
                          disabled={readOnly}
                          onClick={async () => {
                            const destination = await askText({
                              title: `Mover “${view.name}”`,
                              description:
                                "Usa / para crear una ruta de subcarpetas. Deja el campo vacío para mover la vista a la raíz.",
                              label: "Carpeta de destino",
                              initialValue: (view.folderPath ?? []).join(" / "),
                              placeholder: "Ej. Demo / Flujo principal",
                              confirmLabel: "Mover vista",
                              required: false,
                              maxLength: 320,
                            });
                            if (destination === null) {
                              return;
                            }
                            const path = normalizeFolderPath(destination);
                            void persistViews(
                              views.map((item) =>
                                item.id === view.id
                                  ? {
                                      ...item,
                                      folderPath: path.length
                                        ? path
                                        : undefined,
                                      updatedAt: Date.now(),
                                    }
                                  : item,
                              ),
                              withFolderPrefixes(viewFolders, path),
                            );
                          }}
                        >
                          Mover a carpeta…
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
                          className="workspace-menu__danger"
                          disabled={readOnly}
                          onClick={async () => {
                            const confirmed = await askConfirm({
                              title: `Eliminar “${view.name}”`,
                              description:
                                "Se quitará esta vista del recorrido. Los elementos del lienzo no se modificarán.",
                              confirmLabel: "Eliminar vista",
                              destructive: true,
                            });
                            if (confirmed) {
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

      {viewDialog && !presentation && (
        <SavedViewDialog
          key={viewDialog.mode === "edit" ? viewDialog.view.id : "new-view"}
          title={viewDialog.mode === "edit" ? "Editar vista" : "Guardar vista"}
          initialName={
            viewDialog.mode === "edit"
              ? viewDialog.view.name
              : `Vista ${views.length + 1}`
          }
          initialDescription={
            viewDialog.mode === "edit" ? viewDialog.view.description : undefined
          }
          submitLabel={
            viewDialog.mode === "edit" ? "Guardar cambios" : "Guardar vista"
          }
          onCancel={() => setViewDialog(null)}
          onSave={async ({ name, description }) => {
            if (!api) {
              return;
            }
            if (viewDialog.mode === "create") {
              const view = createSavedView(
                loadedCanvas.id,
                api.getAppState(),
                views,
                {
                  name,
                  description,
                  folderPath: activeViewFolderPath,
                },
              );
              await persistViews([...views, view]);
              setSelectedViewId(view.id);
            } else {
              await persistViews(
                views.map((item) =>
                  item.id === viewDialog.view.id
                    ? {
                        ...item,
                        name,
                        description,
                        updatedAt: Date.now(),
                      }
                    : item,
                ),
              );
            }
            setViewDialog(null);
          }}
        />
      )}

      {showColorProfiles && !presentation && (
        <CanvasColorProfilesDialog
          profiles={colorProfiles}
          onClose={() => setShowColorProfiles(false)}
          onSave={async (slot, profile, applyToExistingElements) => {
            const nextProfiles = colorProfiles.slice();
            nextProfiles[slot] = profile;
            await persistColorProfiles(
              nextProfiles,
              profile,
              applyToExistingElements,
            );
          }}
          onDelete={async (slot) => {
            const nextProfiles = colorProfiles.slice();
            nextProfiles[slot] = null;
            await persistColorProfiles(nextProfiles);
          }}
          onResetFactory={async () => {
            const confirmed = await askConfirm({
              title: "Restaurar estilo original",
              description:
                "El lienzo volverá al fondo y a los valores predeterminados de Excalidraw. Tus dibujos y los seis perfiles guardados se conservarán.",
              confirmLabel: "Restaurar estilo",
            });
            if (!confirmed) {
              return;
            }
            await persistColorProfiles(colorProfiles, undefined, false, true);
          }}
        />
      )}

      {showOpenRouter && api && !presentation && (
        <OpenRouterDialog
          repository={repository}
          profileId={profileId}
          profileName={profileName}
          profileProtection={profileProtection}
          profileKey={activeProfileKey}
          api={api}
          onVerifyProfilePassword={onVerifyProfilePassword}
          onProfileKey={setActiveProfileKey}
          onClose={() => setShowOpenRouter(false)}
        />
      )}

      {referenceDialog && !presentation && (
        <WorkspaceReferencesDialog
          repository={repository}
          currentProjectId={projectId}
          currentCanvasId={canvasId}
          currentProjectKey={projectKey}
          initialTarget={
            referenceDialog.mode === "preview"
              ? referenceDialog.target
              : undefined
          }
          onInsert={
            referenceDialog.mode === "browse"
              ? insertWorkspaceReference
              : undefined
          }
          onOpen={(target) => {
            void flushAll().then(() => {
              setReferenceDialog(null);
              if (
                target.kind === "view" &&
                target.projectId === projectId &&
                target.canvasId === canvasId
              ) {
                const view = views.find((item) => item.id === target.viewId);
                if (view) {
                  openView(view);
                }
                return;
              }
              if (target.canvasId) {
                onNavigateReference(
                  target.projectId,
                  target.canvasId,
                  target.viewId,
                );
              }
            });
          }}
          onClose={() => setReferenceDialog(null)}
        />
      )}

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
            {views[presentationIndex]?.description && (
              <small>{views[presentationIndex]?.description}</small>
            )}
            <span>
              {presentationIndex + 1} / {views.length}
            </span>
          </div>
          <span className="presentation-controls__laser">● Láser</span>
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
      {promptDialog}
    </main>
  );
};
