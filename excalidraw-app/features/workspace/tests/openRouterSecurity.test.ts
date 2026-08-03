import { describe, expect, it } from "vitest";

import {
  createProfileProtection,
  unlockProfile,
} from "../crypto/profileCrypto";
import { decryptJson } from "../crypto/projectCrypto";
import {
  reencryptOpenRouterConfiguration,
  saveOpenRouterConfiguration,
  updateOpenRouterModel,
} from "../services/openRouter";
import { IndexedDBWorkspaceRepository } from "../storage/IndexedDBWorkspaceRepository";

describe("OpenRouter profile security", () => {
  it("never persists plaintext and follows a profile password change", async () => {
    const profileId = `profile-${globalThis.crypto.randomUUID()}`;
    const repository = new IndexedDBWorkspaceRepository(
      `openrouter-security-${globalThis.crypto.randomUUID()}`,
    );
    const currentProtection = await createProfileProtection(
      profileId,
      "current-password",
      1_000,
    );
    const nextProtection = await createProfileProtection(
      profileId,
      "next-password",
      1_000,
    );
    const currentKey = await unlockProfile(
      profileId,
      currentProtection,
      "current-password",
    );
    const nextKey = await unlockProfile(
      profileId,
      nextProtection,
      "next-password",
    );

    await saveOpenRouterConfiguration({
      repository,
      profileId,
      profileKey: currentKey,
      apiKey: "sk-or-v1-super-secret",
      model: "google/example-multimodal",
    });
    expect(JSON.stringify(await repository.getSettings())).not.toContain(
      "sk-or-v1-super-secret",
    );
    const originalCiphertext = (await repository.getSettings()).ai?.apiKey
      .ciphertext;
    await updateOpenRouterModel(repository, "google/new-omnimodal");
    const modelUpdated = (await repository.getSettings()).ai!;
    expect(modelUpdated.model).toBe("google/new-omnimodal");
    expect(modelUpdated.apiKey.ciphertext).toBe(originalCiphertext);

    await reencryptOpenRouterConfiguration({
      repository,
      profileId,
      currentKey,
      nextKey,
    });
    const configuration = (await repository.getSettings()).ai!;
    await expect(
      decryptJson(currentKey, configuration.apiKey, {
        projectId: profileId,
        recordType: "openrouter-api-key",
      }),
    ).rejects.toThrow();
    await expect(
      decryptJson<{ value: string }>(nextKey, configuration.apiKey, {
        projectId: profileId,
        recordType: "openrouter-api-key",
      }),
    ).resolves.toEqual({ value: "sk-or-v1-super-secret" });

    await repository.close();
  });
});
