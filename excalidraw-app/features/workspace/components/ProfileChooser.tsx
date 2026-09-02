import type { CSSProperties } from "react";

import type { WorkspaceProfile } from "../domain/types";

const getProfileInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase())
    .join("") || "X";

export const ProfileChooser = ({
  profiles,
  onSelect,
}: {
  profiles: WorkspaceProfile[];
  onSelect: (profileId: string) => void;
}) => (
  <main className="workspace-profile-chooser">
    <div className="workspace-profile-chooser__glow" aria-hidden="true" />
    <header className="workspace-profile-chooser__header">
      <div className="workspace-profile-chooser__brand" aria-hidden="true">
        X
      </div>
      <p className="workspace-eyebrow">XCALIDRAW · ESPACIOS PRIVADOS</p>
      <h1>¿Quién va a crear?</h1>
      <p>Elige un perfil para entrar a sus proyectos y lienzos.</p>
    </header>
    <section
      className="workspace-profile-chooser__grid"
      aria-label="Perfiles disponibles"
    >
      {profiles.map((profile) => (
        <button
          key={profile.id}
          type="button"
          className="workspace-profile-tile"
          style={
            {
              "--profile-accent": profile.appearance.accentColor,
            } as CSSProperties
          }
          onClick={() => onSelect(profile.id)}
          aria-label={`Abrir perfil ${profile.name}`}
        >
          <span className="workspace-profile-tile__portrait" aria-hidden="true">
            <i />
            <strong>{getProfileInitials(profile.name)}</strong>
          </span>
          <span className="workspace-profile-tile__name">{profile.name}</span>
          <span className="workspace-profile-tile__status">
            {profile.protection.enabled ? "● Protegido" : "Espacio local"}
          </span>
        </button>
      ))}
    </section>
    <footer>
      Cada perfil conserva por separado sus proyectos, lienzos, vistas,
      bibliotecas y configuración.
    </footer>
  </main>
);
