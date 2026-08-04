import { useState } from "react";

export const InlineCanvasName = ({
  name,
  disabled,
  onSave,
}: {
  name: string;
  disabled?: boolean;
  onSave: (name: string) => void | Promise<void>;
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  const startEditing = () => {
    if (disabled) {
      return;
    }
    setDraft(name);
    setEditing(true);
  };

  const save = () => {
    const nextName = draft.trim();
    setEditing(false);
    if (nextName && nextName !== name) {
      void onSave(nextName);
    }
  };

  if (editing) {
    return (
      <input
        className="project-workspace__canvas-name is-editing"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onFocus={(event) => event.currentTarget.select()}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            save();
          } else if (event.key === "Escape") {
            event.preventDefault();
            setDraft(name);
            setEditing(false);
          }
        }}
        aria-label="Nombre del lienzo"
        maxLength={120}
        autoFocus
      />
    );
  }

  return (
    <button
      type="button"
      className="project-workspace__canvas-name"
      disabled={disabled}
      onDoubleClick={startEditing}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === "F2") {
          event.preventDefault();
          startEditing();
        }
      }}
      aria-label={`Editar nombre del lienzo ${name}`}
      title="Doble clic para editar"
    >
      {name}
    </button>
  );
};
