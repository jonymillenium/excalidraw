import { useState } from "react";

import { WorkspaceDialog } from "./WorkspaceDialog";

export const SavedViewDialog = ({
  title,
  initialName = "",
  initialDescription = "",
  submitLabel,
  onSave,
  onCancel,
}: {
  title: string;
  initialName?: string;
  initialDescription?: string;
  submitLabel: string;
  onSave: (values: { name: string; description?: string }) => Promise<void>;
  onCancel: () => void;
}) => {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <WorkspaceDialog
      title={title}
      description="El encuadre y el zoom actuales quedarán guardados en este lienzo."
      onClose={onCancel}
    >
      <form
        className="workspace-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          try {
            await onSave({
              name: name.trim(),
              description: description.trim() || undefined,
            });
          } catch (saveError) {
            setError(
              saveError instanceof Error
                ? saveError.message
                : "No se pudo guardar la vista.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Nombre
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={120}
          />
        </label>
        <label>
          Descripción <span className="workspace-muted">(opcional)</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            maxLength={500}
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
            {busy ? "Guardando…" : submitLabel}
          </button>
        </div>
      </form>
    </WorkspaceDialog>
  );
};
