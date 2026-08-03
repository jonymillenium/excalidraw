import { useState } from "react";

import { WorkspaceDialog } from "./WorkspaceDialog";

export const UnlockProjectDialog = ({
  projectName,
  onUnlock,
  onCancel,
}: {
  projectName: string;
  onUnlock: (password: string) => Promise<void>;
  onCancel: () => void;
}) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <WorkspaceDialog
      title="Desbloquear proyecto"
      description={`“${projectName}” está cifrado localmente.`}
      onClose={onCancel}
    >
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
                : "No se pudo desbloquear el proyecto.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Contraseña
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
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
            disabled={busy || !password}
          >
            {busy ? "Desbloqueando…" : "Desbloquear"}
          </button>
        </div>
      </form>
    </WorkspaceDialog>
  );
};
