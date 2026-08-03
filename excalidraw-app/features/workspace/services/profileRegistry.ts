import { createProfileProtection } from "../crypto/profileCrypto";
import {
  DEFAULT_WORKSPACE_APPEARANCE,
  type ProfileProtection,
  type WorkspaceAppearance,
  type WorkspaceProfile,
} from "../domain/types";

const PROFILES_KEY = "xcalidraw.workspace.profiles.v1";
const ACTIVE_PROFILE_KEY = "xcalidraw.workspace.active-profile.v1";

const defaultProfile = (): WorkspaceProfile => {
  const now = Date.now();
  return {
    id: "default",
    name: "Personal",
    createdAt: now,
    updatedAt: now,
    protection: { enabled: false },
    appearance: { ...DEFAULT_WORKSPACE_APPEARANCE },
  };
};

const writeProfiles = (profiles: WorkspaceProfile[]) => {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
};

const isEncryptedEnvelope = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const envelope = value as Record<string, unknown>;
  return (
    envelope.encrypted === true &&
    envelope.algorithm === "AES-GCM" &&
    typeof envelope.iv === "string" &&
    Boolean(envelope.iv) &&
    typeof envelope.ciphertext === "string" &&
    Boolean(envelope.ciphertext) &&
    envelope.schemaVersion === 1
  );
};

const isProtection = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const protection = value as Partial<ProfileProtection>;
  return (
    protection.enabled === false ||
    (protection.enabled === true &&
      protection.version === 1 &&
      protection.kdf === "PBKDF2" &&
      protection.hash === "SHA-256" &&
      typeof protection.iterations === "number" &&
      Number.isFinite(protection.iterations) &&
      protection.iterations > 0 &&
      typeof protection.salt === "string" &&
      Boolean(protection.salt) &&
      isEncryptedEnvelope(protection.verifier))
  );
};

const isAppearance = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const appearance = value as Partial<WorkspaceAppearance>;
  return (
    typeof appearance.accentColor === "string" &&
    /^#[0-9a-f]{6}$/i.test(appearance.accentColor) &&
    ["racing", "contour", "pinstripe"].includes(appearance.accentStyle ?? "") &&
    ["subtle", "vivid"].includes(appearance.accentIntensity ?? "")
  );
};

const isWorkspaceProfile = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const profile = value as Partial<WorkspaceProfile>;
  return (
    typeof profile.id === "string" &&
    Boolean(profile.id) &&
    typeof profile.name === "string" &&
    Boolean(profile.name.trim()) &&
    typeof profile.createdAt === "number" &&
    typeof profile.updatedAt === "number" &&
    (profile.protection === undefined || isProtection(profile.protection)) &&
    (profile.appearance === undefined || isAppearance(profile.appearance))
  );
};

const normalizeProfile = (profile: WorkspaceProfile): WorkspaceProfile => ({
  ...profile,
  protection: isProtection(profile.protection)
    ? profile.protection
    : { enabled: false },
  appearance: isAppearance(profile.appearance)
    ? profile.appearance
    : { ...DEFAULT_WORKSPACE_APPEARANCE },
});

export const getWorkspaceProfiles = (): WorkspaceProfile[] => {
  try {
    const stored = JSON.parse(localStorage.getItem(PROFILES_KEY) ?? "null");
    if (
      Array.isArray(stored) &&
      stored.length &&
      stored.every(isWorkspaceProfile)
    ) {
      const profiles = (stored as WorkspaceProfile[]).map(normalizeProfile);
      writeProfiles(profiles);
      return profiles;
    }
  } catch {
    // A fresh registry is safer than preventing access to existing default data.
  }
  const profiles = [defaultProfile()];
  writeProfiles(profiles);
  return profiles;
};

export const getActiveProfileId = () => {
  const profiles = getWorkspaceProfiles();
  const stored = localStorage.getItem(ACTIVE_PROFILE_KEY);
  return profiles.some((profile) => profile.id === stored)
    ? stored!
    : profiles[0].id;
};

export const setActiveProfileId = (id: string) => {
  localStorage.setItem(ACTIVE_PROFILE_KEY, id);
};

export const createWorkspaceProfile = async (
  name: string,
  password?: string,
): Promise<WorkspaceProfile> => {
  const normalized = name.trim();
  if (!normalized) {
    throw new Error("El nombre del perfil no puede estar vacío.");
  }
  const now = Date.now();
  const id = globalThis.crypto.randomUUID();
  const profile: WorkspaceProfile = {
    id,
    name: normalized,
    createdAt: now,
    updatedAt: now,
    protection: password
      ? await createProfileProtection(id, password)
      : { enabled: false },
    appearance: { ...DEFAULT_WORKSPACE_APPEARANCE },
  };
  writeProfiles([...getWorkspaceProfiles(), profile]);
  return profile;
};

export const importWorkspaceProfile = (
  source: WorkspaceProfile,
): WorkspaceProfile => {
  source = normalizeProfile(source);
  const profiles = getWorkspaceProfiles();
  const existing = profiles.find((profile) => profile.id === source.id);
  if (existing) {
    const restored = {
      ...existing,
      name: source.name,
      createdAt: source.createdAt,
      updatedAt: Math.max(existing.updatedAt, source.updatedAt),
      protection: source.protection,
      appearance: source.appearance,
    };
    writeProfiles(
      profiles.map((profile) =>
        profile.id === source.id ? restored : profile,
      ),
    );
    return restored;
  }
  const profile = { ...source };
  writeProfiles([...profiles, profile]);
  return profile;
};

export const renameWorkspaceProfile = (id: string, name: string) => {
  const normalized = name.trim();
  if (!normalized) {
    throw new Error("El nombre del perfil no puede estar vacío.");
  }
  const profiles = getWorkspaceProfiles().map((profile) =>
    profile.id === id
      ? { ...profile, name: normalized, updatedAt: Date.now() }
      : profile,
  );
  writeProfiles(profiles);
  return profiles;
};

export const updateWorkspaceProfileProtection = (
  id: string,
  protection: ProfileProtection,
) => {
  if (!isProtection(protection)) {
    throw new Error("La protección del perfil no es válida.");
  }
  const profiles = getWorkspaceProfiles().map((profile) =>
    profile.id === id
      ? { ...profile, protection, updatedAt: Date.now() }
      : profile,
  );
  writeProfiles(profiles);
  return profiles;
};

export const updateWorkspaceProfileAppearance = (
  id: string,
  appearance: WorkspaceAppearance,
) => {
  if (!isAppearance(appearance)) {
    throw new Error("La configuración visual no es válida.");
  }
  const profiles = getWorkspaceProfiles().map((profile) =>
    profile.id === id
      ? { ...profile, appearance, updatedAt: Date.now() }
      : profile,
  );
  writeProfiles(profiles);
  return profiles;
};

export const removeWorkspaceProfile = (id: string) => {
  const current = getWorkspaceProfiles();
  if (current.length <= 1) {
    throw new Error("Debe existir al menos un perfil.");
  }
  const wasActive = getActiveProfileId() === id;
  const profiles = current.filter((profile) => profile.id !== id);
  writeProfiles(profiles);
  if (wasActive) {
    setActiveProfileId(profiles[0].id);
  }
  return profiles;
};
