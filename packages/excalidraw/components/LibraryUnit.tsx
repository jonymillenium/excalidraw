import clsx from "clsx";
import { memo, useRef, useState } from "react";

import { useLibraryItemSvg } from "../hooks/useLibraryItemSvg";
import { t } from "../i18n";

import { useEditorInterface } from "./App";
import { CheckboxItem } from "./CheckboxItem";
import { PlusIcon } from "./icons";

import "./LibraryUnit.scss";

import type { LibraryItem } from "../types";
import type { SvgCache } from "../hooks/useLibraryItemSvg";

export const LibraryUnit = memo(
  ({
    id,
    name,
    folderPath,
    elements,
    isPending,
    onClick,
    selected,
    onToggle,
    onDrag,
    onRename,
    svgCache,
  }: {
    id: LibraryItem["id"] | /** for pending item */ null;
    name?: LibraryItem["name"];
    folderPath?: LibraryItem["folderPath"];
    elements?: LibraryItem["elements"];
    isPending?: boolean;
    onClick: (id: LibraryItem["id"] | null) => void;
    selected: boolean;
    onToggle: (id: string, event: React.MouseEvent) => void;
    onDrag: (id: string, event: React.DragEvent) => void;
    onRename?: (id: LibraryItem["id"]) => void;
    svgCache: SvgCache;
  }) => {
    const ref = useRef<HTMLDivElement | null>(null);
    const svg = useLibraryItemSvg(id, elements, svgCache, ref);

    const [isHovered, setIsHovered] = useState(false);
    const isMobile = useEditorInterface().formFactor === "phone";
    const adder = isPending && (
      <div className="library-unit__adder">{PlusIcon}</div>
    );

    return (
      <div
        className="library-unit-wrapper"
        title={
          name
            ? `${name}${
                folderPath?.length ? ` · ${folderPath.join(" / ")}` : ""
              }`
            : undefined
        }
      >
        <div
          className={clsx("library-unit", {
            "library-unit__active": elements,
            "library-unit--hover": elements && isHovered,
            "library-unit--selected": selected,
            "library-unit--skeleton": !svg,
          })}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div
            className={clsx("library-unit__dragger", {
              "library-unit__pulse": !!isPending,
            })}
            ref={ref}
            draggable={!!elements}
            onClick={
              !!elements || !!isPending
                ? (event) => {
                    if (id && event.shiftKey) {
                      onToggle(id, event);
                    } else {
                      onClick(id);
                    }
                  }
                : undefined
            }
            onDragStart={(event) => {
              if (!id) {
                event.preventDefault();
                return;
              }
              setIsHovered(false);
              onDrag(id, event);
            }}
          />
          {adder}
          {id && elements && (isHovered || isMobile || selected) && (
            <CheckboxItem
              checked={selected}
              onChange={(checked, event) => onToggle(id, event)}
              className="library-unit__checkbox"
            />
          )}
        </div>
        {id && onRename ? (
          <button
            type="button"
            className="library-unit__name library-unit__rename"
            onClick={() => onRename(id)}
            aria-label={`${t("library.naming.rename")}: ${
              name || t("library.naming.unnamed")
            }`}
            title={t("library.naming.rename")}
          >
            {name || t("library.naming.unnamed")}
          </button>
        ) : (
          <span className="library-unit__name">
            {isPending
              ? t("library.naming.add")
              : name || t("library.naming.unnamed")}
          </span>
        )}
      </div>
    );
  },
);

export const EmptyLibraryUnit = () => (
  <div className="library-unit library-unit--skeleton" />
);
