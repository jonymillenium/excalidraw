import { useState } from "react";

import { WorkspaceDialog } from "./WorkspaceDialog";

import type { CreateProjectInput } from "../domain/types";

export const CreateProjectDialog = ({
  onCreate,
  onCancel,
}: {
  onCreate: (input: CreateProjectInput) => Promise<void>;
  onCancel: () => void;
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [protect, setProtect] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <WorkspaceDialog
      title="Nuevo proyecto"
      description="Se creará automáticamente un primer lienzo."
      onClose={onCancel}
    >
      <form
        className="workspace-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (protect && password !== confirmPassword) {
            setError("Las contraseñas no coinciden.");
            return;
          }
          setBusy(true);
          setError("");
          try {
            await onCreate({
              name,
              description,
              password: protect ? password : undefined,
            });
          } catch (createError) {
            setError(
              createError instanceof Error
                ? createError.message
                : "No se pudo crear el proyecto.",
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
          />
        </label>
        <label className="workspace-checkbox">
          <input
            type="checkbox"
            checked={protect}
            onChange={(event) => setProtect(event.target.checked)}
          />
          Proteger y cifrar con contraseña
        </label>
        {protect && (
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
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
            </label>
            <div className="workspace-alert workspace-alert--warning">
              No existe recuperación de contraseña. Si la pierdes, no podremos
              recuperar el contenido.
            </div>
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
            disabled={busy || !name.trim() || (protect && !password)}
          >
            {busy ? "Creando…" : "Crear proyecto"}
          </button>
        </div>
      </form>
    </WorkspaceDialog>
  );
};
