import { useEffect, useState } from "react";

import {
  CaptureUpdateAction,
  convertToExcalidrawElements,
  getCommonBounds,
} from "@excalidraw/excalidraw";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  listSuggestedOpenRouterModels,
  readOpenRouterConfiguration,
  generateMermaidFromMediaWithOpenRouter,
  reconstructImageWithOpenRouter,
  removeOpenRouterConfiguration,
  saveOpenRouterConfiguration,
  updateOpenRouterModel,
  type AIReconstruction,
  type AIAnalysisProfile,
  type AIMediaAnalysis,
  type OpenRouterSuggestedModel,
} from "../services/openRouter";

import { WorkspaceDialog } from "./WorkspaceDialog";

import type { ProfileProtection } from "../domain/types";
import type { WorkspaceRepository } from "../storage/WorkspaceRepository";

const readFileAsDataURL = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const priceLabel = (model: OpenRouterSuggestedModel) => {
  const prompt = Number(model.pricing?.prompt ?? 0) * 1_000_000;
  const completion = Number(model.pricing?.completion ?? 0) * 1_000_000;
  if (prompt < 0 || completion < 0) {
    return "Precio variable según enrutado";
  }
  return `$${prompt.toFixed(2)} / $${completion.toFixed(2)} por 1M tokens`;
};

const modalityLabel = (model: OpenRouterSuggestedModel) =>
  (model.architecture?.input_modalities ?? [])
    .filter((modality) => modality !== "text")
    .map(
      (modality) =>
        ({ image: "imagen", audio: "audio", video: "video", file: "PDF" }[
          modality
        ] ?? modality),
    )
    .join(" · ");

const reconstructionToElements = (data: AIReconstruction) => {
  const skeletons = data.elements.map((element) => {
    const common = {
      id: element.id,
      x: element.x,
      y: element.y,
      width: Math.max(1, element.width),
      height: Math.max(1, element.height),
      strokeColor: element.strokeColor || "#1b1b1f",
      backgroundColor: element.backgroundColor || "transparent",
      strokeWidth: Math.max(1, Math.min(4, element.strokeWidth || 1)),
    };
    if (element.type === "text") {
      return {
        ...common,
        type: "text" as const,
        text: element.text,
        fontSize: Math.max(8, Math.min(96, element.fontSize || 20)),
      };
    }
    if (element.type === "line" || element.type === "arrow") {
      return {
        ...common,
        type: element.type,
        ...(element.startId ? { start: { id: element.startId } } : {}),
        ...(element.endId ? { end: { id: element.endId } } : {}),
      };
    }
    return {
      ...common,
      type: element.type,
      fillStyle: "solid" as const,
      ...(element.text
        ? {
            label: {
              text: element.text,
              fontSize: Math.max(8, Math.min(96, element.fontSize || 20)),
            },
          }
        : {}),
    };
  });
  return convertToExcalidrawElements(
    skeletons as Parameters<typeof convertToExcalidrawElements>[0],
  );
};

export const OpenRouterDialog = ({
  repository,
  profileId,
  profileName,
  profileProtection,
  profileKey,
  api,
  onVerifyProfilePassword,
  onProfileKey,
  onClose,
}: {
  repository: WorkspaceRepository;
  profileId: string;
  profileName: string;
  profileProtection: ProfileProtection;
  profileKey?: CryptoKey;
  api: ExcalidrawImperativeAPI;
  onVerifyProfilePassword: (password: string) => Promise<CryptoKey>;
  onProfileKey: (key: CryptoKey) => void;
  onClose: () => void;
}) => {
  const [configuration, setConfiguration] =
    useState<Awaited<ReturnType<typeof readOpenRouterConfiguration>>>();
  const [suggestions, setSuggestions] = useState<OpenRouterSuggestedModel[]>(
    [],
  );
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [password, setPassword] = useState("");
  const [image, setImage] = useState<File>();
  const [prompt, setPrompt] = useState("");
  const [mediaFile, setMediaFile] = useState<File>();
  const [analysisProfile, setAnalysisProfile] =
    useState<AIAnalysisProfile>("executive");
  const [mediaPrompt, setMediaPrompt] = useState("");
  const [mediaAnalysis, setMediaAnalysis] = useState<AIMediaAnalysis>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void readOpenRouterConfiguration(repository).then((next) => {
      setConfiguration(next);
      setModel(next?.model ?? "");
    });
    void listSuggestedOpenRouterModels()
      .then((models) => {
        setSuggestions(models);
        setModel((current) => current || models[0]?.id || "openrouter/auto");
      })
      .catch(() => undefined);
  }, [repository]);

  const refreshConfiguration = async () => {
    const next = await readOpenRouterConfiguration(repository);
    setConfiguration(next);
    setModel(next?.model ?? model);
  };

  const insertGeneratedElements = (
    generated: ReturnType<typeof convertToExcalidrawElements>,
    backgroundColor?: string,
  ) => {
    if (!generated.length) {
      throw new Error("La generación no produjo elementos.");
    }
    api.updateScene({
      elements: [...api.getSceneElementsIncludingDeleted(), ...generated],
      appState: {
        ...api.getAppState(),
        viewBackgroundColor:
          backgroundColor || api.getAppState().viewBackgroundColor,
        selectedElementIds: Object.fromEntries(
          generated.map((element) => [element.id, true]),
        ),
        selectedGroupIds: {},
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    const [x1, y1, x2, y2] = getCommonBounds(generated);
    api.setViewport({
      target: {
        x: x1,
        y: y1,
        width: Math.max(1, x2 - x1),
        height: Math.max(1, y2 - y1),
      },
      fit: "contain",
      animation: { duration: 350 },
      offsets: { ui: true },
    });
    api.setActiveTool({ type: "selection" });
    setMessage(`${generated.length} elementos editables insertados.`);
  };

  const insertReconstruction = (data: AIReconstruction) =>
    insertGeneratedElements(
      reconstructionToElements(data),
      data.backgroundColor,
    );

  const insertMermaid = async (mermaid: string) => {
    const { parseMermaidToExcalidraw } = await import(
      "@excalidraw/mermaid-to-excalidraw"
    );
    const parsed = await parseMermaidToExcalidraw(mermaid);
    if (parsed.files) {
      api.addFiles(Object.values(parsed.files));
    }
    insertGeneratedElements(
      convertToExcalidrawElements(parsed.elements, { regenerateIds: true }),
    );
  };

  const today = configuration?.usage.find(
    (day) => day.date === new Date().toISOString().slice(0, 10),
  );

  return (
    <WorkspaceDialog
      title="IA · OpenRouter"
      description={`Configuración privada del perfil “${profileName}”. La API key se cifra y nunca vuelve a mostrarse.`}
      onClose={onClose}
      size="wide"
    >
      <div className="openrouter-dialog">
        {!profileProtection.enabled && (
          <div className="workspace-alert workspace-alert--error">
            Añade primero una contraseña al perfil. Sin una clave administradora
            no se permite almacenar una API key.
          </div>
        )}

        <section className="openrouter-dialog__section">
          <div className="openrouter-dialog__heading">
            <div>
              <p className="workspace-eyebrow">CONFIGURACIÓN SEGURA</p>
              <h3>OpenRouter</h3>
            </div>
            {configuration && (
              <span className="workspace-badge">
                Key configurada · ••••{configuration.apiKeyHint}
              </span>
            )}
          </div>
          <label>
            Nueva API key
            <input
              type="password"
              autoComplete="new-password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={
                configuration
                  ? "Pega una nueva clave para reemplazarla"
                  : "sk-or-v1-…"
              }
            />
          </label>
          <label>
            Modelo
            <input
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="Proveedor/modelo"
            />
          </label>
          {!!suggestions.length && (
            <div className="openrouter-model-grid">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  className={model === suggestion.id ? "is-active" : ""}
                  onClick={() => setModel(suggestion.id)}
                >
                  <small>{suggestion.recommendation}</small>
                  <strong>{suggestion.name}</strong>
                  <em>{modalityLabel(suggestion) || "texto"}</em>
                  <span>{priceLabel(suggestion)}</span>
                </button>
              ))}
            </div>
          )}
          <label>
            Contraseña administradora del perfil
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Obligatoria para guardar, reemplazar o borrar"
            />
          </label>
          <div className="workspace-dialog__actions">
            {configuration && (
              <button
                type="button"
                className="workspace-button workspace-button--danger"
                disabled={busy || !password}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await onVerifyProfilePassword(password);
                    await removeOpenRouterConfiguration(repository);
                    setPassword("");
                    setApiKey("");
                    await refreshConfiguration();
                    setMessage("La API key fue eliminada del perfil.");
                  } catch (removeError) {
                    setError(
                      removeError instanceof Error
                        ? removeError.message
                        : "No se pudo borrar la configuración.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Borrar API key
              </button>
            )}
            <button
              type="button"
              className="workspace-button workspace-button--primary"
              disabled={
                busy ||
                !profileProtection.enabled ||
                !password ||
                (!configuration && !apiKey.trim()) ||
                !model.trim()
              }
              onClick={async () => {
                setBusy(true);
                setError("");
                setMessage("");
                try {
                  const key = await onVerifyProfilePassword(password);
                  onProfileKey(key);
                  if (apiKey.trim()) {
                    await saveOpenRouterConfiguration({
                      repository,
                      profileId,
                      profileKey: key,
                      apiKey,
                      model,
                    });
                  } else {
                    await updateOpenRouterModel(repository, model);
                  }
                  setApiKey("");
                  setPassword("");
                  await refreshConfiguration();
                  setMessage(
                    apiKey.trim()
                      ? "Configuración cifrada y guardada."
                      : "Modelo actualizado sin exponer la API key.",
                  );
                } catch (saveError) {
                  setError(
                    saveError instanceof Error
                      ? saveError.message
                      : "No se pudo guardar la configuración.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {configuration && !apiKey.trim()
                ? "Guardar modelo"
                : "Guardar configuración"}
            </button>
          </div>
        </section>

        <section className="openrouter-dialog__usage">
          <div>
            <span>Hoy</span>
            <strong>{today?.requests ?? 0}</strong>
            <small>solicitudes</small>
          </div>
          <div>
            <span>Tokens</span>
            <strong>{(today?.totalTokens ?? 0).toLocaleString("es")}</strong>
            <small>
              {(today?.promptTokens ?? 0).toLocaleString("es")} entrada ·{" "}
              {(today?.completionTokens ?? 0).toLocaleString("es")} salida
            </small>
          </div>
          <div>
            <span>Coste informado</span>
            <strong>${(today?.costUsd ?? 0).toFixed(4)}</strong>
            <small>USD hoy</small>
          </div>
        </section>

        {!!configuration?.usage.length && (
          <section className="openrouter-usage-history">
            <div className="openrouter-dialog__heading">
              <div>
                <p className="workspace-eyebrow">CONSUMO DEL PERFIL</p>
                <h3>Historial diario</h3>
              </div>
              <span className="workspace-badge">
                Últimos {Math.min(configuration.usage.length, 14)} días
              </span>
            </div>
            <div className="openrouter-usage-history__table">
              <div className="is-heading">
                <span>Fecha</span>
                <span>Solicitudes</span>
                <span>Tokens</span>
                <span>Coste USD</span>
              </div>
              {configuration.usage.slice(0, 14).map((day) => (
                <div key={day.date}>
                  <strong>
                    {new Intl.DateTimeFormat("es", {
                      day: "2-digit",
                      month: "short",
                    }).format(new Date(`${day.date}T12:00:00`))}
                  </strong>
                  <span>{day.requests}</span>
                  <span>{day.totalTokens.toLocaleString("es")}</span>
                  <span>${day.costUsd.toFixed(4)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="openrouter-dialog__section">
          <div className="openrouter-dialog__heading">
            <div>
              <p className="workspace-eyebrow">MULTIMODAL</p>
              <h3>Screenshot o foto → canvas editable</h3>
            </div>
          </div>
          <label>
            Imagen
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => setImage(event.target.files?.[0])}
            />
          </label>
          <label>
            Indicaciones adicionales
            <textarea
              rows={3}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Ej.: conserva exactamente la grilla, textos y conectores; simplifica solo los iconos decorativos."
            />
          </label>
          <button
            type="button"
            className="workspace-button workspace-button--primary"
            disabled={busy || !configuration || !profileKey || !image}
            onClick={async () => {
              if (!image || !profileKey) {
                return;
              }
              setBusy(true);
              setError("");
              setMessage("");
              try {
                const data = await reconstructImageWithOpenRouter({
                  repository,
                  profileId,
                  profileKey,
                  imageDataURL: await readFileAsDataURL(image),
                  prompt,
                });
                insertReconstruction(data);
                await refreshConfiguration();
              } catch (generationError) {
                setError(
                  generationError instanceof Error
                    ? generationError.message
                    : "No se pudo reconstruir la imagen.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Procesando…" : "Digitalizar como elementos"}
          </button>
        </section>

        <section className="openrouter-dialog__section">
          <div className="openrouter-dialog__heading">
            <div>
              <p className="workspace-eyebrow">ANÁLISIS OMNIMODAL</p>
              <h3>Imagen, PDF, audio o video → Mermaid</h3>
            </div>
          </div>
          <label>
            Material
            <input
              type="file"
              accept="image/*,application/pdf,audio/*,video/mp4,video/mpeg,video/quicktime,video/webm"
              onChange={(event) => {
                setMediaFile(event.target.files?.[0]);
                setMediaAnalysis(undefined);
              }}
            />
          </label>
          <div className="openrouter-analysis-profiles">
            <button
              type="button"
              className={analysisProfile === "executive" ? "is-active" : ""}
              onClick={() => setAnalysisProfile("executive")}
            >
              <strong>Ejecutivo</strong>
              <span>Decisiones, oportunidades, riesgos y próximos pasos.</span>
            </button>
            <button
              type="button"
              className={analysisProfile === "rapid" ? "is-active" : ""}
              onClick={() => setAnalysisProfile("rapid")}
            >
              <strong>Rápido</strong>
              <span>Mapa general esencial para entenderlo en un minuto.</span>
            </button>
            <button
              type="button"
              className={analysisProfile === "deep" ? "is-active" : ""}
              onClick={() => setAnalysisProfile("deep")}
            >
              <strong>Profundo</strong>
              <span>De macro a micro, ramas completas y excepciones.</span>
            </button>
          </div>
          <label>
            Objetivo del análisis
            <textarea
              rows={3}
              value={mediaPrompt}
              onChange={(event) => setMediaPrompt(event.target.value)}
              placeholder="Ej.: conviértelo en un mapa mental de producto para decidir prioridades del próximo trimestre."
            />
          </label>
          <button
            type="button"
            className="workspace-button workspace-button--primary"
            disabled={busy || !configuration || !profileKey || !mediaFile}
            onClick={async () => {
              if (!mediaFile || !profileKey) {
                return;
              }
              setBusy(true);
              setError("");
              setMessage("");
              try {
                const result = await generateMermaidFromMediaWithOpenRouter({
                  repository,
                  profileId,
                  profileKey,
                  file: mediaFile,
                  dataURL: await readFileAsDataURL(mediaFile),
                  profile: analysisProfile,
                  prompt: mediaPrompt,
                });
                setMediaAnalysis(result);
                await refreshConfiguration();
              } catch (analysisError) {
                setError(
                  analysisError instanceof Error
                    ? analysisError.message
                    : "No se pudo analizar el material.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Analizando…" : "Analizar y crear Mermaid"}
          </button>
          {mediaAnalysis && (
            <div className="openrouter-analysis-result">
              <strong>Análisis listo</strong>
              <p>{mediaAnalysis.summary}</p>
              {!!mediaAnalysis.suggestions.length && (
                <div>
                  <span>Para afinar una segunda pasada:</span>
                  <ul>
                    {mediaAnalysis.suggestions.map((suggestion) => (
                      <li key={suggestion}>{suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}
              <button
                type="button"
                className="workspace-button workspace-button--primary"
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await insertMermaid(mediaAnalysis.mermaid);
                  } catch (insertError) {
                    setError(
                      insertError instanceof Error
                        ? insertError.message
                        : "No se pudo insertar el Mermaid.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Insertar Mermaid editable
              </button>
            </div>
          )}
        </section>

        {error && (
          <div className="workspace-alert workspace-alert--error">{error}</div>
        )}
        {message && <div className="workspace-alert">{message}</div>}
      </div>
    </WorkspaceDialog>
  );
};
