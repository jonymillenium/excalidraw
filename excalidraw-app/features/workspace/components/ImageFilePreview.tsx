import { useEffect, useRef, useState } from "react";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;

const clampZoom = (zoom: number) =>
  Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 102.4) / 10} KB`;
  }
  return `${Math.round(bytes / (1024 * 102.4)) / 10} MB`;
};

export const ImageFilePreview = ({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) => {
  const [source, setSource] = useState("");
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [expanded, setExpanded] = useState(false);
  const [fit, setFit] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [panning, setPanning] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<
    | {
        pointerId: number;
        x: number;
        y: number;
        scrollLeft: number;
        scrollTop: number;
      }
    | undefined
  >(undefined);

  useEffect(() => {
    const objectURL = URL.createObjectURL(file);
    setSource(objectURL);
    setNaturalSize({ width: 0, height: 0 });
    setFit(true);
    setZoom(1);
    return () => URL.revokeObjectURL(objectURL);
  }, [file]);

  useEffect(() => {
    if (!expanded) {
      return;
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setExpanded(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [expanded]);

  const changeZoom = (factor: number) => {
    setFit(false);
    setZoom((current) => clampZoom((fit ? 1 : current) * factor));
  };

  const stopPanning = (pointerId: number) => {
    const viewport = viewportRef.current;
    if (viewport?.hasPointerCapture(pointerId)) {
      viewport.releasePointerCapture(pointerId);
    }
    dragRef.current = undefined;
    setPanning(false);
  };

  const image = (
    <img
      src={source}
      alt={`Vista previa de ${file.name}`}
      draggable={false}
      onLoad={(event) =>
        setNaturalSize({
          width: event.currentTarget.naturalWidth,
          height: event.currentTarget.naturalHeight,
        })
      }
    />
  );

  return (
    <>
      <div className="workspace-image-preview">
        <button
          type="button"
          className="workspace-image-preview__thumbnail"
          onClick={() => setExpanded(true)}
          aria-label={`Ver ${file.name} en detalle`}
        >
          {source && image}
          <span>Ver en detalle</span>
        </button>
        <div className="workspace-image-preview__details">
          <strong title={file.name}>{file.name}</strong>
          <span>
            {naturalSize.width && naturalSize.height
              ? `${naturalSize.width.toLocaleString(
                  "es",
                )} × ${naturalSize.height.toLocaleString("es")} px · `
              : ""}
            {formatFileSize(file.size)}
          </span>
          <div>
            <button type="button" onClick={() => setExpanded(true)}>
              Ampliar
            </button>
            <button type="button" onClick={onRemove}>
              Quitar
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div
          className="workspace-image-viewer"
          role="dialog"
          aria-modal="true"
          aria-label={`Vista detallada de ${file.name}`}
        >
          <header className="workspace-image-viewer__header">
            <div>
              <strong title={file.name}>{file.name}</strong>
              <span>
                {naturalSize.width && naturalSize.height
                  ? `${naturalSize.width.toLocaleString(
                      "es",
                    )} × ${naturalSize.height.toLocaleString("es")} px`
                  : "Imagen local"}
              </span>
            </div>
            <button
              type="button"
              className="workspace-image-viewer__close"
              aria-label="Cerrar vista detallada"
              onClick={() => setExpanded(false)}
              autoFocus
            >
              ×
            </button>
          </header>

          <div
            ref={viewportRef}
            className={`workspace-image-viewer__viewport${
              fit ? " is-fit" : ""
            }${panning ? " is-panning" : ""}`}
            onPointerDown={(event) => {
              if (fit || event.button !== 0) {
                return;
              }
              event.currentTarget.setPointerCapture(event.pointerId);
              dragRef.current = {
                pointerId: event.pointerId,
                x: event.clientX,
                y: event.clientY,
                scrollLeft: event.currentTarget.scrollLeft,
                scrollTop: event.currentTarget.scrollTop,
              };
              setPanning(true);
            }}
            onPointerMove={(event) => {
              const drag = dragRef.current;
              if (!drag || drag.pointerId !== event.pointerId) {
                return;
              }
              event.currentTarget.scrollLeft =
                drag.scrollLeft - (event.clientX - drag.x);
              event.currentTarget.scrollTop =
                drag.scrollTop - (event.clientY - drag.y);
            }}
            onPointerUp={(event) => stopPanning(event.pointerId)}
            onPointerCancel={(event) => stopPanning(event.pointerId)}
          >
            {fit ? (
              source && image
            ) : (
              <div
                className="workspace-image-viewer__zoom-surface"
                style={{
                  width: naturalSize.width * zoom,
                  height: naturalSize.height * zoom,
                }}
              >
                {source && image}
              </div>
            )}
          </div>

          <footer className="workspace-image-viewer__controls">
            <button
              type="button"
              onClick={() => changeZoom(0.8)}
              aria-label="Alejar imagen"
            >
              −
            </button>
            <output aria-live="polite">
              {fit ? "Ajustado" : `${Math.round(zoom * 100)}%`}
            </output>
            <button
              type="button"
              onClick={() => changeZoom(1.25)}
              aria-label="Acercar imagen"
            >
              +
            </button>
            <button
              type="button"
              className={fit ? "is-active" : ""}
              onClick={() => setFit(true)}
            >
              Ajustar
            </button>
            <button
              type="button"
              className={!fit && zoom === 1 ? "is-active" : ""}
              onClick={() => {
                setFit(false);
                setZoom(1);
              }}
            >
              100%
            </button>
          </footer>
        </div>
      )}
    </>
  );
};
