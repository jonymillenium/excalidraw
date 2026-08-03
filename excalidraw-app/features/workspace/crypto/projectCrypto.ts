import {
  WORKSPACE_SCHEMA_VERSION,
  type EncryptedEnvelope,
  type ProjectProtection,
} from "../domain/types";

export const PROJECT_KDF_ITERATIONS = 600_000;
export const PROJECT_SALT_BYTES = 16;
export const AES_GCM_IV_BYTES = 12;

export type CryptoContext = {
  projectId: string;
  recordType: string;
  schemaVersion?: number;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const getCrypto = () => {
  if (!globalThis.crypto?.subtle) {
    throw new Error(
      "La protección por contraseña requiere HTTPS o un contexto seguro.",
    );
  }
  return globalThis.crypto;
};

export const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
};

export const base64ToBytes = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const getAdditionalData = ({
  projectId,
  recordType,
  schemaVersion = WORKSPACE_SCHEMA_VERSION,
}: CryptoContext) =>
  encoder.encode(`${schemaVersion}:${projectId}:${recordType}`);

export const createProjectSalt = () => {
  const salt = new Uint8Array(PROJECT_SALT_BYTES);
  getCrypto().getRandomValues(salt);
  return bytesToBase64(salt);
};

export const deriveProjectKey = async (
  password: string,
  salt: string,
  iterations = PROJECT_KDF_ITERATIONS,
) => {
  if (!password) {
    throw new Error("La contraseña no puede estar vacía.");
  }
  const crypto = getCrypto();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: base64ToBytes(salt),
      iterations,
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
};

export const encryptJson = async <T>(
  key: CryptoKey,
  data: T,
  context: CryptoContext,
): Promise<EncryptedEnvelope> => {
  const crypto = getCrypto();
  const iv = new Uint8Array(AES_GCM_IV_BYTES);
  crypto.getRandomValues(iv);
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: getAdditionalData(context),
    },
    key,
    encoder.encode(JSON.stringify(data)),
  );
  return {
    encrypted: true,
    algorithm: "AES-GCM",
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
  };
};

export const decryptJson = async <T>(
  key: CryptoKey,
  envelope: EncryptedEnvelope,
  context: CryptoContext,
): Promise<T> => {
  try {
    const plaintext = await getCrypto().subtle.decrypt(
      {
        name: "AES-GCM",
        iv: base64ToBytes(envelope.iv),
        additionalData: getAdditionalData(context),
      },
      key,
      base64ToBytes(envelope.ciphertext),
    );
    return JSON.parse(decoder.decode(plaintext)) as T;
  } catch {
    throw new Error("La contraseña es incorrecta o los datos están dañados.");
  }
};

export const createProjectProtection = async (
  projectId: string,
  password: string,
  iterations = PROJECT_KDF_ITERATIONS,
): Promise<{
  protection: Extract<ProjectProtection, { enabled: true }>;
  key: CryptoKey;
}> => {
  const salt = createProjectSalt();
  const key = await deriveProjectKey(password, salt, iterations);
  const verifier = await encryptJson(
    key,
    {
      type: "workspace-project-verifier",
      version: 1,
      projectId,
    },
    { projectId, recordType: "verifier" },
  );
  return {
    key,
    protection: {
      enabled: true,
      version: 1,
      kdf: "PBKDF2",
      hash: "SHA-256",
      iterations,
      salt,
      verifier,
    },
  };
};

export const unlockProjectKey = async (
  projectId: string,
  protection: Extract<ProjectProtection, { enabled: true }>,
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
    projectId: string;
  }>(key, protection.verifier, { projectId, recordType: "verifier" });
  if (
    verifier.type !== "workspace-project-verifier" ||
    verifier.version !== 1 ||
    verifier.projectId !== projectId
  ) {
    throw new Error("La contraseña es incorrecta o los datos están dañados.");
  }
  return key;
};
