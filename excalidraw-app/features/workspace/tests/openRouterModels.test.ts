import { describe, expect, it } from "vitest";

import {
  suggestOpenRouterModels,
  type OpenRouterModel,
} from "../services/openRouter";

const model = (
  id: string,
  inputModalities: string[],
  promptPrice: string,
): OpenRouterModel => ({
  id,
  name: id,
  created: 1,
  architecture: {
    input_modalities: inputModalities,
    output_modalities: ["text"],
  },
  supported_parameters: ["structured_outputs"],
  pricing: { prompt: promptPrice, completion: promptPrice },
});

describe("OpenRouter model suggestions", () => {
  it("keeps economical, powerful and Google omnimodal choices", () => {
    const suggestions = suggestOpenRouterModels([
      model("vendor/tiny-vision", ["text", "image"], "0.0000001"),
      model("vendor/flash-vision", ["text", "image"], "0.000001"),
      model("vendor/large-pro", ["text", "image"], "0.00001"),
      model(
        "google/gemini-pro-omni",
        ["text", "image", "audio", "video"],
        "0.00002",
      ),
    ]);

    expect(suggestions.map((item) => item.id)).toContain("vendor/tiny-vision");
    expect(
      suggestions.find((item) => item.id === "vendor/large-pro")
        ?.recommendation,
    ).toBe("Máxima fidelidad");
    expect(
      suggestions.find((item) => item.id === "google/gemini-pro-omni")
        ?.recommendation,
    ).toBe("Omnimodal");
  });

  it("excludes models unable to return structured visual output", () => {
    const unsupported = model(
      "vendor/audio-only",
      ["text", "audio"],
      "0.000001",
    );
    unsupported.supported_parameters = [];
    expect(suggestOpenRouterModels([unsupported])).toEqual([]);
  });

  it("does not classify variable negative pricing as economical", () => {
    const auto = model(
      "openrouter/auto",
      ["text", "image", "audio", "video"],
      "-1",
    );
    expect(
      suggestOpenRouterModels([auto]).find((item) => item.id === auto.id)
        ?.recommendation,
    ).not.toBe("Económico");
  });
});
