import {
  createProfileProtection,
  unlockProfile,
} from "../crypto/profileCrypto";

describe("profile password protection", () => {
  it("does not allow an empty profile password", async () => {
    await expect(
      createProfileProtection("profile-1", "", 1_000),
    ).rejects.toThrow("no puede estar vacía");
  });

  it("unlocks with the correct password", async () => {
    const protection = await createProfileProtection(
      "profile-1",
      "contraseña segura",
      1_000,
    );

    await expect(
      unlockProfile("profile-1", protection, "contraseña segura"),
    ).resolves.toBeUndefined();
  });

  it("rejects an incorrect password", async () => {
    const protection = await createProfileProtection(
      "profile-1",
      "correcta",
      1_000,
    );

    await expect(
      unlockProfile("profile-1", protection, "incorrecta"),
    ).rejects.toThrow();
  });

  it("binds the verifier to its profile", async () => {
    const protection = await createProfileProtection(
      "profile-1",
      "correcta",
      1_000,
    );

    await expect(
      unlockProfile("profile-2", protection, "correcta"),
    ).rejects.toThrow();
  });
});
