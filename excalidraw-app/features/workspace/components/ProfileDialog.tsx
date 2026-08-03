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
  onSubmit: (name: string) => Promise<void>;
  onCancel: () => void;
}) => {
  const [name, setName] = useState(initialName);
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
            await onSubmit(name);
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
            disabled={busy || !name.trim()}
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
