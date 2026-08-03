import { decryptJson, encryptJson } from "../crypto/projectCrypto";

import type { WorkspaceAISettings, WorkspaceAIUsageDay } from "../domain/types";
import type { WorkspaceRepository } from "../storage/WorkspaceRepository";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

export type OpenRouterModel = {
  id: string;
  name: string;
  description?: string;
  created?: number;
  context_length?: number;
  architecture?: {
    input_modalities?: string[];
    output_modalities?: string[];
  };
  supported_parameters?: string[];
  pricing?: {
    prompt?: string;
    completion?: string;
    image?: string;
  };
};

export type OpenRouterSuggestedModel = OpenRouterModel & {
  recommendation:
    | "Económico"
    | "Equilibrado"
    | "Máxima fidelidad"
    | "Omnimodal";
};

export type AIAnalysisProfile = "executive" | "rapid" | "deep";

export type AIMediaAnalysis = {
  mermaid: string;
  summary: string;
  suggestions: string[];
};

type OpenRouterUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost?: number;
};

type OpenRouterResponse = {
  choices?: Array<{
    message?: { content?: string | Array<{ type?: string; text?: string }> };
  }>;
  usage?: OpenRouterUsage;
  error?: { message?: string };
};

export type AIReconstructionElement = {
  id: string;
  type: "rectangle" | "ellipse" | "diamond" | "text" | "line" | "arrow";
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  strokeColor: string;
  backgroundColor: string;
  strokeWidth: number;
  fontSize: number;
  startId: string;
  endId: string;
};

export type AIReconstruction = {
  width: number;
  height: number;
  backgroundColor: string;
  elements: AIReconstructionElement[];
};

const apiKeyContext = (profileId: string) => ({
  projectId: profileId,
  recordType: "openrouter-api-key",
});

export const saveOpenRouterConfiguration = async ({
  repository,
  profileId,
  profileKey,
  apiKey,
  model,
}: {
  repository: WorkspaceRepository;
  profileId: string;
  profileKey: CryptoKey;
  apiKey: string;
  model: string;
}) => {
  const normalizedKey = apiKey.trim();
  const normalizedModel = model.trim();
  if (!normalizedKey || !normalizedModel) {
    throw new Error("La API key y el modelo son obligatorios.");
  }
  const current = await repository.getSettings();
  const ai: WorkspaceAISettings = {
    provider: "openrouter",
    model: normalizedModel,
    apiKey: await encryptJson(
      profileKey,
      { value: normalizedKey },
      apiKeyContext(profileId),
    ),
    apiKeyHint: normalizedKey.slice(-4),
    updatedAt: Date.now(),
    usage: current.ai?.usage ?? [],
  };
  await repository.updateSettings({ ai });
  return ai;
};

export const removeOpenRouterConfiguration = async (
  repository: WorkspaceRepository,
) => {
  await repository.updateSettings({ ai: undefined });
};

export const updateOpenRouterModel = async (
  repository: WorkspaceRepository,
  model: string,
) => {
  const settings = await repository.getSettings();
  const normalizedModel = model.trim();
  if (!settings.ai) {
    throw new Error("Configura primero una API key de OpenRouter.");
  }
  if (!normalizedModel) {
    throw new Error("Selecciona un modelo.");
  }
  await repository.updateSettings({
    ai: {
      ...settings.ai,
      model: normalizedModel,
      updatedAt: Date.now(),
    },
  });
};

export const readOpenRouterConfiguration = async (
  repository: WorkspaceRepository,
) => (await repository.getSettings()).ai;

export const reencryptOpenRouterConfiguration = async ({
  repository,
  profileId,
  currentKey,
  nextKey,
}: {
  repository: WorkspaceRepository;
  profileId: string;
  currentKey: CryptoKey;
  nextKey: CryptoKey;
}) => {
  const settings = await repository.getSettings();
  if (!settings.ai) {
    return;
  }
  const { value } = await decryptJson<{ value: string }>(
    currentKey,
    settings.ai.apiKey,
    apiKeyContext(profileId),
  );
  await repository.updateSettings({
    ai: {
      ...settings.ai,
      apiKey: await encryptJson(nextKey, { value }, apiKeyContext(profileId)),
      updatedAt: Date.now(),
    },
  });
};

const readApiKey = async (
  configuration: WorkspaceAISettings,
  profileId: string,
  profileKey: CryptoKey,
) => {
  const decrypted = await decryptJson<{ value: string }>(
    profileKey,
    configuration.apiKey,
    apiKeyContext(profileId),
  );
  return decrypted.value;
};

const parsePrice = (value?: string) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0
    ? number
    : Number.POSITIVE_INFINITY;
};

export const suggestOpenRouterModels = (models: OpenRouterModel[]) => {
  const capable = models.filter(
    (model) =>
      model.architecture?.input_modalities?.includes("image") &&
      model.architecture?.output_modalities?.includes("text") &&
      model.supported_parameters?.includes("structured_outputs"),
  );
  const price = (model: OpenRouterModel) =>
    parsePrice(model.pricing?.prompt) + parsePrice(model.pricing?.completion);
  const newest = (first: OpenRouterModel, second: OpenRouterModel) =>
    (second.created ?? 0) - (first.created ?? 0);
  const budget = capable
    .filter((model) => Number.isFinite(price(model)))
    .slice()
    .sort((first, second) => price(first) - price(second));
  const balanced = capable
    .filter((model) =>
      /flash|mini|haiku|small/i.test(`${model.id} ${model.name}`),
    )
    .sort(newest);
  const precise = capable
    .filter((model) =>
      /pro|ultra|sonnet|opus|gpt-5|vision|large/i.test(
        `${model.id} ${model.name}`,
      ),
    )
    .sort(newest);
  const omni = capable
    .filter(
      (model) =>
        /google|gemini/i.test(`${model.id} ${model.name}`) &&
        model.architecture?.input_modalities?.some((modality) =>
          ["audio", "video"].includes(modality),
        ),
    )
    .sort(newest);
  const suggestions = new Map<string, OpenRouterSuggestedModel>();
  const add = (
    models: OpenRouterModel[],
    recommendation: OpenRouterSuggestedModel["recommendation"],
    count: number,
  ) => {
    let added = 0;
    for (const model of models) {
      if (added >= count) {
        break;
      }
      if (suggestions.has(model.id)) {
        if (recommendation === "Omnimodal") {
          suggestions.set(model.id, { ...model, recommendation });
          added += 1;
        }
        continue;
      }
      suggestions.set(model.id, { ...model, recommendation });
      added += 1;
    }
  };
  add(budget.slice(0, 2), "Económico", 2);
  add(balanced, "Equilibrado", 2);
  add(precise, "Máxima fidelidad", 2);
  add(omni, "Omnimodal", 2);
  return [...suggestions.values()].slice(0, 8);
};

export const listSuggestedOpenRouterModels = async () => {
  const response = await fetch(OPENROUTER_MODELS_URL);
  if (!response.ok) {
    throw new Error("No se pudo consultar el catálogo de OpenRouter.");
  }
  const payload = (await response.json()) as { data?: OpenRouterModel[] };
  return suggestOpenRouterModels(payload.data ?? []);
};

const usageDate = () => new Date().toISOString().slice(0, 10);

const recordUsage = async (
  repository: WorkspaceRepository,
  usage?: OpenRouterUsage,
) => {
  const settings = await repository.getSettings();
  if (!settings.ai) {
    return;
  }
  const date = usageDate();
  const existing = settings.ai.usage.find((day) => day.date === date);
  const day: WorkspaceAIUsageDay = {
    date,
    requests: (existing?.requests ?? 0) + 1,
    promptTokens: (existing?.promptTokens ?? 0) + (usage?.prompt_tokens ?? 0),
    completionTokens:
      (existing?.completionTokens ?? 0) + (usage?.completion_tokens ?? 0),
    totalTokens: (existing?.totalTokens ?? 0) + (usage?.total_tokens ?? 0),
    costUsd: (existing?.costUsd ?? 0) + (usage?.cost ?? 0),
  };
  const usageDays = [
    ...settings.ai.usage.filter((item) => item.date !== date),
    day,
  ]
    .sort((first, second) => second.date.localeCompare(first.date))
    .slice(0, 180);
  await repository.updateSettings({
    ai: { ...settings.ai, usage: usageDays },
  });
};

const getContent = (payload: OpenRouterResponse) => {
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content.map((part) => part.text ?? "").join("");
  }
  throw new Error(
    payload.error?.message || "OpenRouter no devolvió contenido.",
  );
};

const callOpenRouter = async ({
  repository,
  profileId,
  profileKey,
  body,
}: {
  repository: WorkspaceRepository;
  profileId: string;
  profileKey: CryptoKey;
  body: Record<string, unknown>;
}) => {
  const configuration = await readOpenRouterConfiguration(repository);
  if (!configuration) {
    throw new Error("Configura primero OpenRouter en este perfil.");
  }
  const apiKey = await readApiKey(configuration, profileId, profileKey);
  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(window.location.origin !== "null"
        ? { "HTTP-Referer": window.location.origin }
        : {}),
      "X-Title": "Xcalidraw",
    },
    body: JSON.stringify({ model: configuration.model, ...body }),
  });
  const payload = (await response.json()) as OpenRouterResponse;
  if (!response.ok) {
    throw new Error(
      payload.error?.message || `OpenRouter respondió ${response.status}.`,
    );
  }
  await recordUsage(repository, payload.usage);
  return getContent(payload);
};

const stripMermaidFence = (content: string) =>
  content
    .trim()
    .replace(/^```(?:mermaid)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

export const generateMermaidWithOpenRouter = async ({
  repository,
  profileId,
  profileKey,
  messages,
}: {
  repository: WorkspaceRepository;
  profileId: string;
  profileKey: CryptoKey;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}) =>
  stripMermaidFence(
    await callOpenRouter({
      repository,
      profileId,
      profileKey,
      body: {
        temperature: 0.15,
        messages: [
          {
            role: "system",
            content:
              "Convert the request into valid Mermaid. Return only Mermaid source, no markdown fences or explanation. Prefer flowchart, sequenceDiagram, classDiagram, or erDiagram. Keep labels concise and preserve the user's language.",
          },
          ...messages,
        ],
      },
    }),
  );

const reconstructionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    width: { type: "number" },
    height: { type: "number" },
    backgroundColor: { type: "string" },
    elements: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          type: {
            type: "string",
            enum: ["rectangle", "ellipse", "diamond", "text", "line", "arrow"],
          },
          x: { type: "number" },
          y: { type: "number" },
          width: { type: "number" },
          height: { type: "number" },
          text: { type: "string" },
          strokeColor: { type: "string" },
          backgroundColor: { type: "string" },
          strokeWidth: { type: "number" },
          fontSize: { type: "number" },
          startId: { type: "string" },
          endId: { type: "string" },
        },
        required: [
          "id",
          "type",
          "x",
          "y",
          "width",
          "height",
          "text",
          "strokeColor",
          "backgroundColor",
          "strokeWidth",
          "fontSize",
          "startId",
          "endId",
        ],
      },
    },
  },
  required: ["width", "height", "backgroundColor", "elements"],
} as const;

export const reconstructImageWithOpenRouter = async ({
  repository,
  profileId,
  profileKey,
  imageDataURL,
  prompt,
}: {
  repository: WorkspaceRepository;
  profileId: string;
  profileKey: CryptoKey;
  imageDataURL: string;
  prompt?: string;
}) => {
  const content = await callOpenRouter({
    repository,
    profileId,
    profileKey,
    body: {
      temperature: 0.1,
      provider: { require_parameters: true },
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "excalidraw_reconstruction",
          strict: true,
          schema: reconstructionSchema,
        },
      },
      messages: [
        {
          role: "system",
          content:
            "Reconstruct the supplied screenshot or hand drawing as editable intelligent diagram primitives. Preserve spatial hierarchy, text, colors, alignment, spacing, and connectors as faithfully as possible. Use rectangles, ellipses, diamonds, text, lines, and arrows. Return coordinates in a canvas matching the source aspect ratio. For connectors set startId/endId to referenced element ids, otherwise use empty strings.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                prompt?.trim() ||
                "Digitize this image pixel-precisely into editable diagram elements.",
            },
            { type: "image_url", image_url: { url: imageDataURL } },
          ],
        },
      ],
    },
  });
  const parsed = JSON.parse(content) as AIReconstruction;
  if (!Array.isArray(parsed.elements) || !parsed.width || !parsed.height) {
    throw new Error("El modelo devolvió una reconstrucción inválida.");
  }
  return parsed;
};

const analysisProfilePrompts: Record<AIAnalysisProfile, string> = {
  executive:
    "Executive/entrepreneur profile: prioritize thesis, opportunities, risks, decisions, dependencies, business impact, and concrete next steps. Keep the hierarchy useful for action.",
  rapid:
    "Rapid overview profile: extract only the essential structure, main actors, key sequence, and a small set of conclusions. Optimize for scanning in under one minute.",
  deep: "Deep hierarchical profile: preserve the complete information from general to specific, split every major branch into detailed sub-branches, surface relationships and exceptions, and avoid silently omitting material facts.",
};

const mediaAnalysisSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    mermaid: { type: "string" },
    summary: { type: "string" },
    suggestions: { type: "array", items: { type: "string" } },
  },
  required: ["mermaid", "summary", "suggestions"],
} as const;

const getAudioFormat = (file: File) => {
  const extension = file.name.split(".").at(-1)?.toLowerCase();
  if (extension) {
    return extension === "mpeg" ? "mp3" : extension;
  }
  return file.type.split("/").at(-1) || "mp3";
};

const mediaContent = (file: File, dataURL: string) => {
  if (file.type.startsWith("image/")) {
    return { type: "image_url", image_url: { url: dataURL } };
  }
  if (file.type.startsWith("video/")) {
    return { type: "video_url", video_url: { url: dataURL } };
  }
  if (file.type.startsWith("audio/")) {
    return {
      type: "input_audio",
      input_audio: {
        data: dataURL.split(",")[1] ?? "",
        format: getAudioFormat(file),
      },
    };
  }
  if (file.type === "application/pdf") {
    return {
      type: "file",
      file: { filename: file.name, file_data: dataURL },
    };
  }
  throw new Error("Usa una imagen, PDF, audio o video compatible.");
};

export const generateMermaidFromMediaWithOpenRouter = async ({
  repository,
  profileId,
  profileKey,
  file,
  dataURL,
  profile,
  prompt,
}: {
  repository: WorkspaceRepository;
  profileId: string;
  profileKey: CryptoKey;
  file: File;
  dataURL: string;
  profile: AIAnalysisProfile;
  prompt?: string;
}) => {
  const content = await callOpenRouter({
    repository,
    profileId,
    profileKey,
    body: {
      temperature: profile === "rapid" ? 0.1 : 0.2,
      provider: { require_parameters: true },
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "media_to_mermaid",
          strict: true,
          schema: mediaAnalysisSchema,
        },
      },
      messages: [
        {
          role: "system",
          content: `Analyze the supplied material and create a valid, editable Mermaid flowchart in the user's language. Return Mermaid source without markdown fences inside the mermaid field. ${analysisProfilePrompts[profile]} The summary must explain the chosen structure. The suggestions array must contain 2-4 sharp follow-up questions or improvements that would make a second pass more useful.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                prompt?.trim() ||
                "Analyze all relevant content and turn it into the selected diagram profile.",
            },
            mediaContent(file, dataURL),
          ],
        },
      ],
    },
  });
  const parsed = JSON.parse(content) as AIMediaAnalysis;
  if (!parsed.mermaid || !Array.isArray(parsed.suggestions)) {
    throw new Error("El modelo devolvió un análisis inválido.");
  }
  return { ...parsed, mermaid: stripMermaidFence(parsed.mermaid) };
};
