import { useEffect, useRef, useState } from "react";

import { t } from "../i18n";
import { getShortcutKey } from "../shortcut";

const LONG_PRESS_DURATION = 450;

export const ZoomMenu = ({
  zoomValue,
  selectionAvailable,
  onReset,
  onZoomToFit,
  onZoomToSelection,
  onZoomToFitViewport,
}: {
  zoomValue: number;
  selectionAvailable: boolean;
  onReset: () => void;
  onZoomToFit: () => void;
  onZoomToSelection: () => void;
  onZoomToFitViewport: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ignoreNextClickRef = useRef(false);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useEffect(() => clearLongPressTimer, []);

  const runAndClose = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div className="zoom-menu-control" ref={rootRef}>
      <button
        type="button"
        className="reset-zoom-button zoom-button zoom-menu-control__value"
        title={`${t("buttons.resetZoom")} · ${t("buttons.zoomOptions")}`}
        aria-label={t("buttons.resetZoom")}
        onPointerDown={(event) => {
          if (event.button > 0) {
            return;
          }
          clearLongPressTimer();
          ignoreNextClickRef.current = false;
          longPressTimerRef.current = setTimeout(() => {
            ignoreNextClickRef.current = true;
            setOpen(true);
          }, LONG_PRESS_DURATION);
        }}
        onPointerUp={clearLongPressTimer}
        onPointerCancel={() => {
          clearLongPressTimer();
          ignoreNextClickRef.current = false;
        }}
        onPointerLeave={clearLongPressTimer}
        onContextMenu={(event) => event.preventDefault()}
        onClick={() => {
          if (ignoreNextClickRef.current) {
            ignoreNextClickRef.current = false;
            return;
          }
          onReset();
        }}
      >
        {(zoomValue * 100).toFixed(0)}%
      </button>
      <button
        type="button"
        className="zoom-button zoom-menu-control__toggle"
        title={t("buttons.zoomOptions")}
        aria-label={t("buttons.zoomOptions")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
          <path d="m3 4.5 3 3 3-3" />
        </svg>
      </button>
      {open && (
        <div
          className="zoom-menu-control__menu"
          role="menu"
          aria-label={t("buttons.zoomOptions")}
        >
          <button role="menuitem" onClick={() => runAndClose(onReset)}>
            <span>100%</span>
            <kbd>{getShortcutKey("CtrlOrCmd+0")}</kbd>
          </button>
          <button role="menuitem" onClick={() => runAndClose(onZoomToFit)}>
            <span>{t("helpDialog.zoomToFit")}</span>
            <kbd>{getShortcutKey("Shift+1")}</kbd>
          </button>
          <button
            role="menuitem"
            disabled={!selectionAvailable}
            onClick={() => runAndClose(onZoomToSelection)}
          >
            <span>{t("helpDialog.zoomToSelection")}</span>
            <kbd>{getShortcutKey("Shift+3")}</kbd>
          </button>
          <button
            role="menuitem"
            onClick={() => runAndClose(onZoomToFitViewport)}
          >
            <span>{t("labels.zoomToFitViewport")}</span>
            <kbd>{getShortcutKey("Shift+2")}</kbd>
          </button>
        </div>
      )}
    </div>
  );
};
