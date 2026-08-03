import { useState, type CSSProperties } from "react";

import { WorkspaceDialog } from "./WorkspaceDialog";

import type {
  WorkspaceAccentIntensity,
  WorkspaceAccentStyle,
  WorkspaceAppearance,
} from "../domain/types";

const ACCENT_COLORS = [
  { name: "Giallo", value: "#ffd400" },
  { name: "Rosso", value: "#ff3b30" },
  { name: "Arancio", value: "#ff7a00" },
  { name: "Verde", value: "#b7ff2a" },
  { name: "Blu", value: "#2f7bff" },
  { name: "Viola", value: "#a855f7" },
  { name: "Magenta", value: "#ff3ea5" },
  { name: "Bianco", value: "#f2f0e8" },
];

const STYLE_OPTIONS: Array<{
  value: WorkspaceAccentStyle;
  name: string;
  description: string;
}> = [
  {
    value: "contour",
    name: "Curvas aerodinámicas",
    description: "Trazos fluidos inspirados en una carrocería italiana.",
  },
  {
    value: "racing",
    name: "Líneas GT",
    description: "Cortes rápidos, tensos y deportivos.",
  },
  {
    value: "pinstripe",
    name: "Contorno limpio",
    description: "Un borde preciso y contenido, sin resplandor.",
  },
];

export const AppearanceDialog = ({
  initialAppearance,
  onSave,
  onCancel,
}: {
  initialAppearance: WorkspaceAppearance;
  onSave: (appearance: WorkspaceAppearance) => Promise<void>;
  onCancel: () => void;
}) => {
  const [accentColor, setAccentColor] = useState(initialAppearance.accentColor);
  const [accentStyle, setAccentStyle] = useState<WorkspaceAccentStyle>(
    initialAppearance.accentStyle,
  );
  const [accentIntensity, setAccentIntensity] =
    useState<WorkspaceAccentIntensity>(initialAppearance.accentIntensity);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const previewStyle = {
    "--workspace-preview-accent": accentColor,
  } as CSSProperties;

  return (
    <WorkspaceDialog
      title="Apariencia"
      description="Combina una superficie oscura con curvas, contornos y líneas de acento inspiradas en diseño automotriz."
      onClose={onCancel}
    >
      <form
        className="workspace-form workspace-appearance-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          try {
            await onSave({ accentColor, accentStyle, accentIntensity });
          } catch (saveError) {
            setError(
              saveError instanceof Error
                ? saveError.message
                : "No se pudo guardar la apariencia.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <div
          className="workspace-appearance-preview"
          data-style={accentStyle}
          data-intensity={accentIntensity}
          style={previewStyle}
        >
          <div className="workspace-appearance-preview__lines">
            <i />
            <i />
            <i />
          </div>
          <div>
            <span>X</span>
            <strong>OBSIDIAN / {accentColor.toUpperCase()}</strong>
          </div>
          <small>Contorno de ventana y acentos de interfaz</small>
        </div>

        <fieldset className="workspace-color-fieldset">
          <legend>Color de acento</legend>
          <div className="workspace-color-swatches">
            {ACCENT_COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                className={accentColor === color.value ? "is-active" : ""}
                style={{ backgroundColor: color.value }}
                onClick={() => setAccentColor(color.value)}
                aria-label={color.name}
                title={color.name}
              />
            ))}
            <label
              className="workspace-color-custom"
              title="Color personalizado"
            >
              <input
                type="color"
                value={accentColor}
                onChange={(event) => setAccentColor(event.target.value)}
              />
              +
            </label>
          </div>
        </fieldset>

        <fieldset className="workspace-choice-group">
          <legend>Diseño de líneas</legend>
          {STYLE_OPTIONS.map((option) => (
            <label className="workspace-choice" key={option.value}>
              <input
                type="radio"
                name="accent-style"
                checked={accentStyle === option.value}
                onChange={() => setAccentStyle(option.value)}
              />
              <span>
                <strong>{option.name}</strong>
                <small>{option.description}</small>
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset className="workspace-choice-group workspace-choice-group--inline">
          <legend>Intensidad</legend>
          {(["subtle", "vivid"] as const).map((intensity) => (
            <label className="workspace-choice" key={intensity}>
              <input
                type="radio"
                name="accent-intensity"
                checked={accentIntensity === intensity}
                onChange={() => setAccentIntensity(intensity)}
              />
              <span>
                <strong>{intensity === "subtle" ? "Sutil" : "Vibrante"}</strong>
              </span>
            </label>
          ))}
        </fieldset>

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
            {busy ? "Guardando…" : "Aplicar apariencia"}
          </button>
        </div>
      </form>
    </WorkspaceDialog>
  );
};
