import { useState } from "react";

import type { WorkspaceProfile } from "../domain/types";

export const ProfileUnlockScreen = ({
  profile,
  profiles,
  onProfileChange,
  onUnlock,
}: {
  profile: WorkspaceProfile;
  profiles: WorkspaceProfile[];
  onProfileChange: (profileId: string) => void;
  onUnlock: (password: string) => Promise<void>;
}) => {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <main className="workspace-profile-lock">
      <div className="workspace-accent-lines" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <section className="workspace-profile-lock__card">
        <div className="workspace-profile-lock__mark" aria-hidden="true">
          X
        </div>
        <p className="workspace-eyebrow">PERFIL PROTEGIDO</p>
        <h1>{profile.name}</h1>
        <p>Introduce la contraseña para acceder a sus proyectos y lienzos.</p>
        <form
          className="workspace-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            try {
              await onUnlock(password);
            } catch (unlockError) {
              setError(
                unlockError instanceof Error
                  ? unlockError.message
                  : "No se pudo desbloquear el perfil.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Contraseña
            <input
              autoFocus
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error && (
            <div className="workspace-alert workspace-alert--error">
              {error}
            </div>
          )}
          <button
            type="submit"
            className="workspace-button workspace-button--primary workspace-button--full"
            disabled={busy || !password}
          >
            {busy ? "Desbloqueando…" : "Desbloquear perfil"}
          </button>
        </form>
        {profiles.length > 1 && (
          <label className="workspace-profile-lock__switcher">
            Abrir otro perfil
            <select
              value={profile.id}
              onChange={(event) => onProfileChange(event.target.value)}
            >
              {profiles.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.protection.enabled ? "🔒 " : ""}
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <small>
          La contraseña no se guarda. No existe recuperación automática. Los
          proyectos protegidos mantienen además su propio cifrado.
        </small>
      </section>
    </main>
  );
};
