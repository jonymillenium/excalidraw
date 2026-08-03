import { useMemo, useState } from "react";

import {
  contrastRatio,
  deriveElementColor,
  normalizeCanvasColorProfiles,
} from "../domain/canvasColors";

import { WorkspaceDialog } from "./WorkspaceDialog";

import type { CanvasColorProfile, CanvasContrastLevel } from "../domain/types";

const createId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const contrastLabels: Record<CanvasContrastLevel, string> = {
  soft: "Suave · 3:1",
  balanced: "Equilibrado · 4.5:1",
  high: "Alto · 7:1",
  custom: "Personalizado",
};

type Draft = Pick<
  CanvasColorProfile,
  "name" | "backgroundColor" | "elementColor" | "contrastLevel"
>;

const emptyDraft = (slot: number): Draft => ({
  name: `Perfil ${slot + 1}`,
  backgroundColor: "#ffffff",
  elementColor: "#1b1b1f",
  contrastLevel: "balanced",
});

export const CanvasColorProfilesDialog = ({
  profiles,
  onSave,
  onDelete,
  onClose,
}: {
  profiles: Array<CanvasColorProfile | null>;
  onSave: (
    slot: number,
    profile: CanvasColorProfile,
    applyToExistingElements: boolean,
  ) => Promise<void>;
  onDelete: (slot: number) => Promise<void>;
  onClose: () => void;
}) => {
  const normalizedProfiles = useMemo(
    () => normalizeCanvasColorProfiles(profiles),
    [profiles],
  );
  const [activeSlot, setActiveSlot] = useState(0);
  const [draft, setDraft] = useState<Draft>(() =>
    normalizedProfiles[0] ? { ...normalizedProfiles[0]! } : emptyDraft(0),
  );
  const [applyToExistingElements, setApplyToExistingElements] = useState(true);
  const [busy, setBusy] = useState(false);
  const ratio = contrastRatio(draft.backgroundColor, draft.elementColor);

  const selectSlot = (slot: number) => {
    setActiveSlot(slot);
    const profile = normalizedProfiles[slot];
    setDraft(profile ? { ...profile } : emptyDraft(slot));
  };

  const setContrastLevel = (contrastLevel: CanvasContrastLevel) => {
    setDraft((current) => ({
      ...current,
      contrastLevel,
      elementColor:
        contrastLevel === "custom"
          ? current.elementColor
          : deriveElementColor(current.backgroundColor, contrastLevel),
    }));
  };

  return (
    <WorkspaceDialog
      title="Perfiles de color del lienzo"
      description="Guarda hasta seis combinaciones de fondo y contraste. Cada perfil queda dentro del lienzo y viaja con sus backups."
      onClose={onClose}
    >
      <div className="canvas-color-profiles">
        <div className="canvas-color-profiles__slots" role="list">
          {normalizedProfiles.map((profile, index) => (
            <button
              key={profile?.id ?? `empty-${index}`}
              type="button"
              role="listitem"
              className={`canvas-color-slot${
                index === activeSlot ? " is-active" : ""
              }`}
              onClick={() => selectSlot(index)}
              style={
                profile
                  ? {
                      backgroundColor: profile.backgroundColor,
                      color: profile.elementColor,
                    }
                  : undefined
              }
            >
              <span>{profile ? `Aa` : "+"}</span>
              <small>{profile?.name ?? `Slot ${index + 1}`}</small>
            </button>
          ))}
        </div>

        <form
          className="workspace-form canvas-color-profile-editor"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            try {
              const existing = normalizedProfiles[activeSlot];
              await onSave(
                activeSlot,
                {
                  id: existing?.id ?? createId(),
                  ...draft,
                  name: draft.name.trim(),
                  updatedAt: Date.now(),
                },
                applyToExistingElements,
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Nombre
            <input
              value={draft.name}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              required
              maxLength={80}
            />
          </label>
          <div className="canvas-color-profile-editor__colors">
            <label>
              Fondo
              <span className="workspace-color-input">
                <input
                  type="color"
                  value={draft.backgroundColor}
                  onChange={(event) => {
                    const backgroundColor = event.target.value;
                    setDraft((current) => ({
                      ...current,
                      backgroundColor,
                      elementColor:
                        current.contrastLevel === "custom"
                          ? current.elementColor
                          : deriveElementColor(
                              backgroundColor,
                              current.contrastLevel,
                            ),
                    }));
                  }}
                />
                <code>{draft.backgroundColor}</code>
              </span>
            </label>
            <label>
              Elementos
              <span className="workspace-color-input">
                <input
                  type="color"
                  value={draft.elementColor}
                  disabled={draft.contrastLevel !== "custom"}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      elementColor: event.target.value,
                    }))
                  }
                />
                <code>{draft.elementColor}</code>
              </span>
            </label>
          </div>
          <label>
            Contraste
            <select
              value={draft.contrastLevel}
              onChange={(event) =>
                setContrastLevel(event.target.value as CanvasContrastLevel)
              }
            >
              {Object.entries(contrastLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div
            className="canvas-color-profile-editor__preview"
            style={{
              backgroundColor: draft.backgroundColor,
              color: draft.elementColor,
            }}
          >
            <span>Formas, líneas y texto</span>
            <strong>{ratio.toFixed(2)}:1</strong>
          </div>
          <label className="workspace-checkbox-row">
            <input
              type="checkbox"
              checked={applyToExistingElements}
              onChange={(event) =>
                setApplyToExistingElements(event.target.checked)
              }
            />
            Aplicar el color también a los elementos que ya existen
          </label>
          <div className="workspace-dialog__actions">
            {normalizedProfiles[activeSlot] && (
              <button
                type="button"
                className="workspace-button workspace-button--danger"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onDelete(activeSlot);
                    setDraft(emptyDraft(activeSlot));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Vaciar slot
              </button>
            )}
            <button
              type="button"
              className="workspace-button"
              onClick={onClose}
            >
              Cerrar
            </button>
            <button
              type="submit"
              className="workspace-button workspace-button--primary"
              disabled={busy || !draft.name.trim()}
            >
              {busy ? "Guardando…" : "Guardar y aplicar"}
            </button>
          </div>
        </form>
      </div>
    </WorkspaceDialog>
  );
};
