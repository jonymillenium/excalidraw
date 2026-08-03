import { useState } from "react";

import { WorkspaceDialog } from "./WorkspaceDialog";

export const ProfileDialog = ({
  mode,
  initialName = "",
  onSubmit,
  onCancel,
}: {
  mode: "create" | "rename";
  initialName?: string;
  onSubmit: (input: { name: string; password?: string }) => Promise<void>;
  onCancel: () => void;
}) => {
  const [name, setName] = useState(initialName);
  const [protectProfile, setProtectProfile] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <WorkspaceDialog
      title={mode === "create" ? "Nuevo perfil" : "Renombrar perfil"}
      description="Cada perfil conserva sus propios proyectos, lienzos y configuraciones en un almacenamiento local separado."
      onClose={onCancel}
    >
      <form
        className="workspace-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          try {
            if (protectProfile && password !== confirmation) {
              throw new Error("Las contraseñas no coinciden.");
            }
            await onSubmit({
              name,
              password: protectProfile ? password : undefined,
            });
          } catch (submitError) {
            setError(
              submitError instanceof Error
                ? submitError.message
                : "No se pudo guardar el perfil.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Nombre
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ej. Personal, Trabajo, Cliente"
            required
          />
        </label>
        {mode === "create" && (
          <>
            <label className="workspace-checkbox">
              <input
                type="checkbox"
                checked={protectProfile}
                onChange={(event) => setProtectProfile(event.target.checked)}
              />
              Pedir contraseña al abrir este perfil
            </label>
            {protectProfile && (
              <div className="workspace-form__passwords">
                <label>
                  Contraseña
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </label>
                <label>
                  Confirmar contraseña
                  <input
                    type="password"
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </label>
                <small className="workspace-muted">
                  No existe recuperación. La contraseña se verifica localmente y
                  nunca se guarda. Este bloqueo controla el acceso al perfil; el
                  cifrado del contenido se configura por proyecto.
                </small>
              </div>
            )}
          </>
        )}
        {error && (
          <div className="workspace-alert workspace-alert--error">{error}</div>
        )}
        <div className="workspace-dialog__actions">
          <button type="button" className="workspace-button" onClick={onCancel}>
            Cancelar
          </button>
          <button
            type="submit"
            className="workspace-button workspace-button--primary"
            disabled={
              busy ||
              !name.trim() ||
              (protectProfile && (!password || !confirmation))
            }
          >
            {busy
              ? "Guardando…"
              : mode === "create"
              ? "Crear perfil"
              : "Guardar nombre"}
          </button>
        </div>
      </form>
    </WorkspaceDialog>
  );
};
