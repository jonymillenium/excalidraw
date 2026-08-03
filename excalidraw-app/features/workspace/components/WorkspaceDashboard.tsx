import { useRef } from "react";

import type { ProfilePasswordMode } from "./ProfilePasswordDialog";
import type { ProjectSummary, WorkspaceProfile } from "../domain/types";
import type { ApplicationUpdateStatus } from "../services/updateChecker";

export type ProjectAction =
  | "open"
  | "rename"
  | "duplicate"
  | "protect"
  | "change-password"
  | "remove-password"
  | "lock"
  | "export"
  | "delete"
  | "move-up"
  | "move-down";

const formatDate = (date: number) =>
  new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);

export const WorkspaceDashboard = ({
  projects,
  profiles,
  activeProfileId,
  activeProfileProtected,
  updateStatus,
  unlockedProjectIds,
  message,
  onCreate,
  onImport,
  onImportBackup,
  onExportBackup,
  onProfileChange,
  onCreateProfile,
  onRenameProfile,
  onDeleteProfile,
  onAppearance,
  onProfilePasswordAction,
  onLockProfile,
  onCheckForUpdates,
  onProjectAction,
}: {
  projects: ProjectSummary[];
  profiles: WorkspaceProfile[];
  activeProfileId: string;
  activeProfileProtected: boolean;
  updateStatus: ApplicationUpdateStatus;
  unlockedProjectIds: Set<string>;
  message?: string;
  onCreate: () => void;
  onImport: (file: File) => void;
  onImportBackup: (file: File) => void;
  onExportBackup: () => void;
  onProfileChange: (profileId: string) => void;
  onCreateProfile: () => void;
  onRenameProfile: () => void;
  onDeleteProfile: () => void;
  onAppearance: () => void;
  onProfilePasswordAction: (mode: ProfilePasswordMode) => void;
  onLockProfile: () => void;
  onCheckForUpdates: () => void;
  onProjectAction: (project: ProjectSummary, action: ProjectAction) => void;
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  return (
    <main className="workspace-dashboard">
      <div className="workspace-accent-lines" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <header className="workspace-dashboard__header">
        <div>
          <div className="workspace-brand-mark" aria-hidden="true">
            X
          </div>
          <div>
            <p className="workspace-eyebrow">LOCAL-FIRST WORKSPACE</p>
            <h1>Tus proyectos</h1>
            <p className="workspace-lede">
              Organiza lienzos, guarda recorridos y protege el trabajo que
              importa.
            </p>
          </div>
        </div>
        <div className="workspace-dashboard__header-actions">
          {updateStatus.state === "available" ? (
            <a
              className="workspace-update workspace-update--available"
              href={updateStatus.url}
              target="_blank"
              rel="noreferrer"
              title="Ver los cambios publicados en GitHub"
            >
              <span>Nueva versión</span>
              <strong>
                {updateStatus.commits === null
                  ? "Cambios publicados"
                  : `${updateStatus.commits} ${
                      updateStatus.commits === 1 ? "cambio" : "cambios"
                    }`}
              </strong>
            </a>
          ) : (
            <button
              type="button"
              className="workspace-update"
              onClick={onCheckForUpdates}
              disabled={updateStatus.state === "checking"}
              title={
                updateStatus.state === "error"
                  ? updateStatus.message
                  : "Consultar la versión publicada en GitHub"
              }
            >
              <span>
                {updateStatus.state === "idle"
                  ? "Actualizaciones"
                  : `Versión ${
                      "version" in updateStatus ? updateStatus.version : ""
                    }`}
              </span>
              <strong>
                {updateStatus.state === "idle"
                  ? "Comprobar actualizaciones"
                  : updateStatus.state === "checking"
                  ? "Buscando…"
                  : updateStatus.state === "current"
                  ? "Al día"
                  : updateStatus.state === "error"
                  ? "Reintentar"
                  : "Desarrollo"}
              </strong>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".excalidraw-workspace,application/json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                onImport(file);
              }
              event.target.value = "";
            }}
          />
          <input
            ref={backupInputRef}
            type="file"
            accept=".xcalidraw-backup,application/json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                onImportBackup(file);
              }
              event.target.value = "";
            }}
          />
          <button
            type="button"
            className="workspace-button"
            onClick={() => fileInputRef.current?.click()}
          >
            Importar proyecto
          </button>
          <button
            type="button"
            className="workspace-button"
            onClick={() => backupInputRef.current?.click()}
          >
            Restaurar backup
          </button>
          <button
            type="button"
            className="workspace-button"
            onClick={onExportBackup}
          >
            Exportar todo
          </button>
          <button
            type="button"
            className="workspace-button workspace-button--primary"
            onClick={onCreate}
          >
            + Nuevo proyecto
          </button>
        </div>
      </header>

      <section className="workspace-profile-bar" aria-label="Perfil local">
        <label>
          <span>Perfil</span>
          <select
            value={activeProfileId}
            onChange={(event) => onProfileChange(event.target.value)}
          >
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.protection.enabled ? "🔒 " : ""}
                {profile.name}
              </option>
            ))}
          </select>
        </label>
        <div>
          <button className="workspace-button" onClick={onAppearance}>
            Apariencia
          </button>
          <button className="workspace-button" onClick={onCreateProfile}>
            Nuevo perfil
          </button>
          <button className="workspace-button" onClick={onRenameProfile}>
            Renombrar
          </button>
          <details className="workspace-menu workspace-menu--profile">
            <summary className="workspace-button">
              {activeProfileProtected ? "Seguridad · Activa" : "Seguridad"}
            </summary>
            <div className="workspace-menu__items">
              {activeProfileProtected ? (
                <>
                  <button
                    type="button"
                    onClick={() => onProfilePasswordAction("change")}
                  >
                    Cambiar contraseña
                  </button>
                  <button
                    type="button"
                    onClick={() => onProfilePasswordAction("remove")}
                  >
                    Quitar contraseña
                  </button>
                  <button type="button" onClick={onLockProfile}>
                    Bloquear perfil ahora
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => onProfilePasswordAction("add")}
                >
                  Agregar contraseña
                </button>
              )}
            </div>
          </details>
          <button
            className="workspace-button"
            onClick={onDeleteProfile}
            disabled={profiles.length <= 1}
          >
            Eliminar perfil
          </button>
        </div>
      </section>

      {message && (
        <div className="workspace-alert workspace-alert--info">{message}</div>
      )}

      {!projects.length ? (
        <section className="workspace-empty-state">
          <div className="workspace-empty-state__art" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <h2>Un lugar para cada idea</h2>
          <p>
            Crea tu primer proyecto. Dentro podrás separar lienzos y recorrer
            zonas del canvas como una presentación.
          </p>
          <button
            type="button"
            className="workspace-button workspace-button--primary"
            onClick={onCreate}
          >
            Crear primer proyecto
          </button>
        </section>
      ) : (
        <section className="workspace-project-grid" aria-label="Proyectos">
          {projects.map((project, index) => {
            const unlocked = unlockedProjectIds.has(project.id);
            return (
              <article className="workspace-project-card" key={project.id}>
                <button
                  type="button"
                  className="workspace-project-card__open"
                  onClick={() => onProjectAction(project, "open")}
                >
                  <div className="workspace-project-card__preview">
                    <div className="workspace-project-card__canvas-line" />
                    <div className="workspace-project-card__canvas-box" />
                    <div className="workspace-project-card__canvas-dot" />
                    {project.protection.enabled && (
                      <span
                        className="workspace-project-card__lock"
                        aria-hidden="true"
                      >
                        {unlocked ? "◉" : "●"}
                      </span>
                    )}
                  </div>
                  <div className="workspace-project-card__content">
                    <div className="workspace-project-card__title-row">
                      <h2>{project.name}</h2>
                      {project.protection.enabled && (
                        <span className="workspace-badge">
                          {unlocked ? "Desbloqueado" : "Protegido"}
                        </span>
                      )}
                    </div>
                    <p>
                      {project.canvasCount}{" "}
                      {project.canvasCount === 1 ? "lienzo" : "lienzos"}
                    </p>
                    <time dateTime={new Date(project.updatedAt).toISOString()}>
                      Editado {formatDate(project.updatedAt)}
                    </time>
                  </div>
                </button>
                <div className="workspace-project-card__footer">
                  <div
                    className="workspace-order-controls"
                    aria-label="Cambiar orden"
                  >
                    <button
                      type="button"
                      className="workspace-icon-button"
                      disabled={index === 0}
                      onClick={() => onProjectAction(project, "move-up")}
                      aria-label={`Subir ${project.name}`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="workspace-icon-button"
                      disabled={index === projects.length - 1}
                      onClick={() => onProjectAction(project, "move-down")}
                      aria-label={`Bajar ${project.name}`}
                    >
                      ↓
                    </button>
                  </div>
                  <details className="workspace-menu">
                    <summary aria-label={`Acciones para ${project.name}`}>
                      •••
                    </summary>
                    <div className="workspace-menu__items">
                      <button onClick={() => onProjectAction(project, "open")}>
                        Abrir
                      </button>
                      <button
                        onClick={() => onProjectAction(project, "rename")}
                      >
                        Renombrar
                      </button>
                      <button
                        onClick={() => onProjectAction(project, "duplicate")}
                      >
                        Duplicar
                      </button>
                      {!project.protection.enabled ? (
                        <button
                          onClick={() => onProjectAction(project, "protect")}
                        >
                          Proteger
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() =>
                              onProjectAction(project, "change-password")
                            }
                          >
                            Cambiar contraseña
                          </button>
                          <button
                            onClick={() =>
                              onProjectAction(project, "remove-password")
                            }
                          >
                            Quitar contraseña
                          </button>
                          {unlocked && (
                            <button
                              onClick={() => onProjectAction(project, "lock")}
                            >
                              Bloquear ahora
                            </button>
                          )}
                        </>
                      )}
                      <button
                        onClick={() => onProjectAction(project, "export")}
                      >
                        Exportar
                      </button>
                      <button
                        className="workspace-menu__danger"
                        onClick={() => onProjectAction(project, "delete")}
                      >
                        Eliminar
                      </button>
                    </div>
                  </details>
                </div>
              </article>
            );
          })}
        </section>
      )}
      <footer className="workspace-dashboard__footer">
        <span>Los datos permanecen en este dispositivo.</span>
        <span>Sin cuentas · Sin nube · Sin telemetría nueva</span>
      </footer>
    </main>
  );
};
