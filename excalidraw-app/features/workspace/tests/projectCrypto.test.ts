import { webcrypto } from "node:crypto";

import {
  createProjectProtection,
  decryptJson,
  encryptJson,
  unlockProjectKey,
} from "../crypto/projectCrypto";

describe("projectCrypto", () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: webcrypto,
    });
  });

  it("encrypts and authenticates a project payload", async () => {
    const projectId = "project-crypto-test";
    const { key, protection } = await createProjectProtection(
      projectId,
      "correct horse battery staple",
      1_000,
    );
    const envelope = await encryptJson(
      key,
      { secret: "mapa estratégico" },
      { projectId, recordType: "canvas:one" },
    );

    expect(envelope.encrypted).toBe(true);
    expect(JSON.stringify(envelope)).not.toContain("mapa estratégico");
    expect(
      await decryptJson<{ secret: string }>(key, envelope, {
        projectId,
        recordType: "canvas:one",
      }),
    ).toEqual({ secret: "mapa estratégico" });
    await expect(
      unlockProjectKey(projectId, protection, "contraseña incorrecta"),
    ).rejects.toThrow("La contraseña es incorrecta o los datos están dañados.");
  });

  it("uses a fresh 96-bit IV for every encryption", async () => {
    const projectId = "project-iv-test";
    const { key } = await createProjectProtection(projectId, "secret", 1_000);
    const first = await encryptJson(
      key,
      { value: 1 },
      {
        projectId,
        recordType: "canvas:one",
      },
    );
    const second = await encryptJson(
      key,
      { value: 1 },
      {
        projectId,
        recordType: "canvas:one",
      },
    );

    expect(first.iv).not.toBe(second.iv);
    expect(atob(first.iv)).toHaveLength(12);
  });

  it("rejects ciphertext under a different AAD context", async () => {
    const projectId = "project-aad-test";
    const { key } = await createProjectProtection(projectId, "secret", 1_000);
    const envelope = await encryptJson(
      key,
      { value: 1 },
      {
        projectId,
        recordType: "canvas:one",
      },
    );

    await expect(
      decryptJson(key, envelope, {
        projectId,
        recordType: "canvas:two",
      }),
    ).rejects.toThrow("La contraseña es incorrecta o los datos están dañados.");
  });
});
