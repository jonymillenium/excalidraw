import {
  PROJECT_KDF_ITERATIONS,
  createProjectSalt,
  decryptJson,
  deriveProjectKey,
  encryptJson,
} from "./projectCrypto";

import type { ProfileProtection } from "../domain/types";

export const createProfileProtection = async (
  profileId: string,
  password: string,
  iterations = PROJECT_KDF_ITERATIONS,
): Promise<Extract<ProfileProtection, { enabled: true }>> => {
  if (!password) {
    throw new Error("La contraseña del perfil no puede estar vacía.");
  }
  const salt = createProjectSalt();
  const key = await deriveProjectKey(password, salt, iterations);
  const verifier = await encryptJson(
    key,
    {
      type: "workspace-profile-verifier",
      version: 1,
      profileId,
    },
    { projectId: profileId, recordType: "profile-verifier" },
  );
  return {
    enabled: true,
    version: 1,
    kdf: "PBKDF2",
    hash: "SHA-256",
    iterations,
    salt,
    verifier,
  };
};

export const unlockProfile = async (
  profileId: string,
  protection: Extract<ProfileProtection, { enabled: true }>,
  password: string,
) => {
  const key = await deriveProjectKey(
    password,
    protection.salt,
    protection.iterations,
  );
  const verifier = await decryptJson<{
    type: string;
    version: number;
    profileId: string;
  }>(key, protection.verifier, {
    projectId: profileId,
    recordType: "profile-verifier",
  });
  if (
    verifier.type !== "workspace-profile-verifier" ||
    verifier.version !== 1 ||
    verifier.profileId !== profileId
  ) {
    throw new Error("La contraseña es incorrecta o los datos están dañados.");
  }
  return key;
};
