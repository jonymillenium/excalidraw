import { useState } from "react";

import { WorkspaceDialog } from "./WorkspaceDialog";

import type { WorkspaceBackup } from "../domain/types";

export const BackupDialog = ({
  profileName,
  profileCount,
  onExport,
  onCancel,
}: {
  profileName: string;
  profileCount: number;
  onExport: (options: {
    scope: WorkspaceBackup["scope"];
    includeSettings: boolean;
  }) => Promise<void>;
  onCancel: () => void;
}) => {
  const [scope, setScope] = useState<WorkspaceBackup["scope"]>("profile");
  const [includeSettings, setIncludeSettings] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <WorkspaceDialog
      title="Exportar backup"
      description="Elige cuánto contenido portable quieres guardar. Los proyectos protegidos conservan su cifrado y contraseña."
      onClose={onCancel}
    >
      <form
        className="workspace-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          try {
            await onExport({ scope, includeSettings });
          } catch (exportError) {
            setError(
              exportError instanceof Error
                ? exportError.message
                : "No se pudo exportar el backup.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset className="workspace-choice-group">
          <legend>Contenido</legend>
          <label className="workspace-choice">
            <input
              type="radio"
              name="backup-scope"
              checked={scope === "profile"}
              onChange={() => setScope("profile")}
            />
            <span>
              <strong>Perfil “{profileName}”</strong>
              <small>Todos sus proyectos, lienzos, vistas y archivos.</small>
            </span>
          </label>
          <label className="workspace-choice">
            <input
              type="radio"
              name="backup-scope"
              checked={scope === "all-profiles"}
              onChange={() => setScope("all-profiles")}
            />
            <span>
              <strong>Todos los perfiles ({profileCount})</strong>
              <small>Una copia portable completa de la aplicación.</small>
            </span>
          </label>
        </fieldset>
        <label className="workspace-checkbox">
          <input
            type="checkbox"
            checked={includeSettings}
            onChange={(event) => setIncludeSettings(event.target.checked)}
          />
          Incluir configuración y último lienzo abierto
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
            disabled={busy}
          >
            {busy ? "Exportando…" : "Descargar backup"}
          </button>
        </div>
      </form>
    </WorkspaceDialog>
  );
};
