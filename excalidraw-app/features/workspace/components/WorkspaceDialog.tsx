import { useEffect, useRef } from "react";

export const WorkspaceDialog = ({
  title,
  description,
  children,
  onClose,
  size = "default",
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  onClose: () => void;
  size?: "default" | "wide";
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLElement>("input, button, textarea")?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialog) {
        return;
      }
      const focusable = [
        ...dialog.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
        ),
      ];
      if (!focusable.length) {
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previous?.focus();
    };
  }, []);

  return (
    <div className="workspace-dialog-backdrop" role="presentation">
      <div
        ref={dialogRef}
        className={`workspace-dialog workspace-dialog--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-dialog-title"
      >
        <div className="workspace-dialog__heading">
          <div>
            <h2 id="workspace-dialog-title">{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button
            type="button"
            className="workspace-icon-button"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};
