import type { WorkspaceProfile } from "../domain/types";

const PROFILES_KEY = "xcalidraw.workspace.profiles.v1";
const ACTIVE_PROFILE_KEY = "xcalidraw.workspace.active-profile.v1";

const defaultProfile = (): WorkspaceProfile => {
  const now = Date.now();
  return { id: "default", name: "Personal", createdAt: now, updatedAt: now };
};

const writeProfiles = (profiles: WorkspaceProfile[]) => {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
};

const isWorkspaceProfile = (value: unknown): value is WorkspaceProfile => {
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
    typeof profile.updatedAt === "number"
  );
};

export const getWorkspaceProfiles = (): WorkspaceProfile[] => {
  try {
    const stored = JSON.parse(localStorage.getItem(PROFILES_KEY) ?? "null");
    if (
      Array.isArray(stored) &&
      stored.length &&
      stored.every(isWorkspaceProfile)
    ) {
      return stored;
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

export const createWorkspaceProfile = (name: string): WorkspaceProfile => {
  const normalized = name.trim();
  if (!normalized) {
    throw new Error("El nombre del perfil no puede estar vacío.");
  }
  const now = Date.now();
  const profile = {
    id: globalThis.crypto.randomUUID(),
    name: normalized,
    createdAt: now,
    updatedAt: now,
  };
  writeProfiles([...getWorkspaceProfiles(), profile]);
  return profile;
};

export const importWorkspaceProfile = (
  source: WorkspaceProfile,
): WorkspaceProfile => {
  const profiles = getWorkspaceProfiles();
  const existing = profiles.find((profile) => profile.id === source.id);
  if (existing) {
    const restored = {
      ...existing,
      name: source.name,
      createdAt: source.createdAt,
      updatedAt: Math.max(existing.updatedAt, source.updatedAt),
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
