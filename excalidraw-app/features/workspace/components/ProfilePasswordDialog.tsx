import { useState } from "react";

import { WorkspaceDialog } from "./WorkspaceDialog";

export type ProfilePasswordMode = "add" | "change" | "remove";

const copy: Record<
  ProfilePasswordMode,
  { title: string; description: string; action: string }
> = {
  add: {
    title: "Agregar contraseña",
    description:
      "Xcalidraw pedirá la contraseña cada vez que abras la aplicación o vuelvas a este perfil.",
    action: "Agregar contraseña",
  },
  change: {
    title: "Cambiar contraseña",
    description:
      "Confirma la contraseña actual y elige una nueva. No existe recuperación.",
    action: "Cambiar contraseña",
  },
  remove: {
    title: "Quitar contraseña",
    description: "El perfil volverá a abrirse sin solicitar una contraseña.",
    action: "Quitar contraseña",
  },
};

export const ProfilePasswordDialog = ({
  mode,
  profileName,
  onSubmit,
  onCancel,
}: {
  mode: ProfilePasswordMode;
  profileName: string;
  onSubmit: (input: {
    currentPassword?: string;
    newPassword?: string;
  }) => Promise<void>;
  onCancel: () => void;
}) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const needsCurrent = mode !== "add";
  const needsNew = mode !== "remove";

  return (
    <WorkspaceDialog
      title={copy[mode].title}
      description={`${copy[mode].description} Perfil: “${profileName}”.`}
      onClose={onCancel}
    >
      <form
        className="workspace-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          try {
            if (needsNew && newPassword !== confirmation) {
              throw new Error("Las contraseñas no coinciden.");
            }
            await onSubmit({
              currentPassword: needsCurrent ? currentPassword : undefined,
              newPassword: needsNew ? newPassword : undefined,
            });
          } catch (submitError) {
            setError(
              submitError instanceof Error
                ? submitError.message
                : "No se pudo actualizar la contraseña.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {needsCurrent && (
          <label>
            Contraseña actual
            <input
              autoFocus
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
        )}
        {needsNew && (
          <div className="workspace-form__passwords">
            <label>
              Nueva contraseña
              <input
                autoFocus={!needsCurrent}
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
            </label>
            <label>
              Confirmar nueva contraseña
              <input
                type="password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="new-password"
                required
              />
            </label>
          </div>
        )}
        {mode === "remove" && (
          <div className="workspace-alert workspace-alert--warning">
            Esto quita el bloqueo de acceso del perfil. Las contraseñas de
            proyectos protegidos no cambian.
          </div>
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
              (needsCurrent && !currentPassword) ||
              (needsNew && (!newPassword || !confirmation))
            }
          >
            {busy ? "Guardando…" : copy[mode].action}
          </button>
        </div>
      </form>
    </WorkspaceDialog>
  );
};
