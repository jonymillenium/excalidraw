import { useRef } from "react";

import type { ProjectSummary } from "../domain/types";

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
  unlockedProjectIds,
  message,
  onCreate,
  onImport,
  onProjectAction,
}: {
  projects: ProjectSummary[];
  unlockedProjectIds: Set<string>;
  message?: string;
  onCreate: () => void;
  onImport: (file: File) => void;
  onProjectAction: (project: ProjectSummary, action: ProjectAction) => void;
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <main className="workspace-dashboard">
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
          <button
            type="button"
            className="workspace-button"
            onClick={() => fileInputRef.current?.click()}
          >
            Importar
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
