import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { MIME_TYPES, arrayToMap, nextAnimationFrame } from "@excalidraw/common";

import { duplicateElements } from "@excalidraw/element";

import clsx from "clsx";

import { deburr } from "../deburr";
import {
  collectLibraryFolders,
  isSameLibraryFolder,
  libraryFolderPathKey,
  loadCreatedLibraryFolders,
  normalizeLibraryFolderName,
  saveCreatedLibraryFolders,
} from "../data/libraryFolders";

import { useLibraryCache } from "../hooks/useLibraryItemSvg";
import { useScrollPosition } from "../hooks/useScrollPosition";
import { t } from "../i18n";

import { LibraryMenuControlButtons } from "./LibraryMenuControlButtons";
import { LibraryDropdownMenu } from "./LibraryMenuHeaderContent";
import {
  LibraryMenuSection,
  LibraryMenuSectionGrid,
} from "./LibraryMenuSection";

import Spinner from "./Spinner";
import Stack from "./Stack";

import "./LibraryMenuItems.scss";

import { TextField } from "./TextField";

import { useApp, useEditorInterface } from "./App";

import { Button } from "./Button";
import { Dialog } from "./Dialog";

import type { ExcalidrawLibraryIds } from "../data/types";

import type {
  ExcalidrawProps,
  LibraryItem,
  LibraryItems,
  UIAppState,
} from "../types";

// using an odd number of items per batch so the rendering creates an irregular
// pattern which looks more organic
const ITEMS_RENDERED_PER_BATCH = 17;
// when render outputs cached we can render many more items per batch to
// speed it up
const CACHED_ITEMS_RENDERED_PER_BATCH = 64;
export default function LibraryMenuItems({
  isLoading,
  libraryItems,
  onAddToLibrary,
  onInsertLibraryItems,
  pendingElements,
  theme,
  id,
  libraryReturnUrl,
  onSelectItems,
  selectedItems,
}: {
  isLoading: boolean;
  libraryItems: LibraryItems;
  pendingElements: LibraryItem["elements"];
  onInsertLibraryItems: (libraryItems: LibraryItems) => void;
  onAddToLibrary: (
    elements: LibraryItem["elements"],
    name: string,
    folderPath: readonly string[],
  ) => void;
  libraryReturnUrl: ExcalidrawProps["libraryReturnUrl"];
  theme: UIAppState["theme"];
  id: string;
  selectedItems: LibraryItem["id"][];
  onSelectItems: (id: LibraryItem["id"][]) => void;
}) {
  const editorInterface = useEditorInterface();
  const app = useApp();
  const libraryContainerRef = useRef<HTMLDivElement>(null);
  const scrollPosition = useScrollPosition<HTMLDivElement>(libraryContainerRef);

  // This effect has to be called only on first render, therefore  `scrollPosition` isn't in the dependency array
  useEffect(() => {
    if (scrollPosition > 0) {
      libraryContainerRef.current?.scrollTo(0, scrollPosition);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { svgCache } = useLibraryCache();
  const [lastSelectedItem, setLastSelectedItem] = useState<
    LibraryItem["id"] | null
  >(null);

  const [searchInputValue, setSearchInputValue] = useState("");
  const [activeFolderPath, setActiveFolderPath] = useState<string[]>([]);
  const [createdFolderPaths, setCreatedFolderPaths] = useState<string[][]>(
    loadCreatedLibraryFolders,
  );
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [assetName, setAssetName] = useState("");
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [renameItemId, setRenameItemId] = useState<LibraryItem["id"] | null>(
    null,
  );
  const [renameItemName, setRenameItemName] = useState("");

  useEffect(() => {
    saveCreatedLibraryFolders(createdFolderPaths);
  }, [createdFolderPaths]);

  const allFolderPaths = useMemo(
    () => collectLibraryFolders(libraryItems, createdFolderPaths),
    [createdFolderPaths, libraryItems],
  );

  const childFolders = useMemo(() => {
    const names = new Set<string>();
    for (const path of allFolderPaths) {
      if (
        path.length > activeFolderPath.length &&
        activeFolderPath.every((part, index) => path[index] === part)
      ) {
        names.add(path[activeFolderPath.length]);
      }
    }
    return [...names].sort((first, second) =>
      first.localeCompare(second, undefined, { sensitivity: "base" }),
    );
  }, [activeFolderPath, allFolderPaths]);

  const IS_LIBRARY_EMPTY = !libraryItems.length && !pendingElements.length;

  const IS_SEARCHING = !IS_LIBRARY_EMPTY && !!searchInputValue.trim();

  const filteredItems = useMemo(() => {
    const searchQuery = deburr(searchInputValue.trim().toLowerCase());
    if (!searchQuery) {
      return [];
    }

    return libraryItems.filter((item) => {
      const itemName = item.name || "";
      const folderName = (item.folderPath ?? []).join(" / ");
      return deburr(`${itemName} ${folderName}`.toLowerCase()).includes(
        searchQuery,
      );
    });
  }, [libraryItems, searchInputValue]);

  const unpublishedItems = useMemo(
    () =>
      libraryItems.filter(
        (item) =>
          item.status !== "published" &&
          isSameLibraryFolder(item.folderPath, activeFolderPath),
      ),
    [activeFolderPath, libraryItems],
  );

  const publishedItems = useMemo(
    () =>
      libraryItems.filter(
        (item) =>
          item.status === "published" &&
          isSameLibraryFolder(item.folderPath, activeFolderPath),
      ),
    [activeFolderPath, libraryItems],
  );

  const onItemSelectToggle = useCallback(
    (id: LibraryItem["id"], event: React.MouseEvent) => {
      const shouldSelect = !selectedItems.includes(id);
      const orderedItems = [...unpublishedItems, ...publishedItems];
      if (shouldSelect) {
        if (event.shiftKey && lastSelectedItem) {
          const rangeStart = orderedItems.findIndex(
            (item) => item.id === lastSelectedItem,
          );
          const rangeEnd = orderedItems.findIndex((item) => item.id === id);

          if (rangeStart === -1 || rangeEnd === -1) {
            onSelectItems([...selectedItems, id]);
            return;
          }

          const selectedItemsMap = arrayToMap(selectedItems);
          // Support both top-down and bottom-up selection by using min/max
          const minRange = Math.min(rangeStart, rangeEnd);
          const maxRange = Math.max(rangeStart, rangeEnd);
          const nextSelectedIds = orderedItems.reduce(
            (acc: LibraryItem["id"][], item, idx) => {
              if (
                (idx >= minRange && idx <= maxRange) ||
                selectedItemsMap.has(item.id)
              ) {
                acc.push(item.id);
              }
              return acc;
            },
            [],
          );
          onSelectItems(nextSelectedIds);
        } else {
          onSelectItems([...selectedItems, id]);
        }
        setLastSelectedItem(id);
      } else {
        setLastSelectedItem(null);
        onSelectItems(selectedItems.filter((_id) => _id !== id));
      }
    },
    [
      lastSelectedItem,
      onSelectItems,
      publishedItems,
      selectedItems,
      unpublishedItems,
    ],
  );

  useEffect(() => {
    // if selection is removed (e.g. via esc), reset last selected item
    // so that subsequent shift+clicks don't select a large range
    if (!selectedItems.length) {
      setLastSelectedItem(null);
    }
  }, [selectedItems]);

  const getInsertedElements = useCallback(
    (id: string) => {
      let targetElements;
      if (selectedItems.includes(id)) {
        targetElements = libraryItems.filter((item) =>
          selectedItems.includes(item.id),
        );
      } else {
        targetElements = libraryItems.filter((item) => item.id === id);
      }
      return targetElements.map((item) => {
        return {
          ...item,
          // duplicate each library item before inserting on canvas to confine
          // ids and bindings to each library item. See #6465
          elements: duplicateElements({
            type: "everything",
            elements: item.elements,
            randomizeSeed: true,
            preserveFrameChildrenOrder: true,
          }).duplicatedElements,
        };
      });
    },
    [libraryItems, selectedItems],
  );

  const onItemDrag = useCallback(
    (id: LibraryItem["id"], event: React.DragEvent) => {
      // we want to serialize just the ids so the operation is fast and there's
      // no race condition if people drop the library items on canvas too fast
      const data: ExcalidrawLibraryIds = {
        itemIds: selectedItems.includes(id) ? selectedItems : [id],
      };
      event.dataTransfer.setData(
        MIME_TYPES.excalidrawlibIds,
        JSON.stringify(data),
      );
    },
    [selectedItems],
  );

  const isItemSelected = useCallback(
    (id: LibraryItem["id"] | null) => {
      if (!id) {
        return false;
      }
      return selectedItems.includes(id);
    },
    [selectedItems],
  );

  const onAddToLibraryClick = useCallback(() => {
    setAssetName(
      `${t("library.naming.defaultName")} ${libraryItems.length + 1}`,
    );
    setShowNameDialog(true);
  }, [libraryItems.length]);

  const createFolder = useCallback(() => {
    setFolderName("");
    setShowFolderDialog(true);
  }, []);

  const moveSelectedHere = useCallback(() => {
    if (!selectedItems.length) {
      return;
    }
    void app.library
      .setLibrary(
        libraryItems.map((item) =>
          selectedItems.includes(item.id)
            ? { ...item, folderPath: [...activeFolderPath] }
            : item,
        ),
      )
      .then(() => onSelectItems([]));
  }, [
    activeFolderPath,
    app.library,
    libraryItems,
    onSelectItems,
    selectedItems,
  ]);

  const renameItem = useCallback(
    (id: LibraryItem["id"] | undefined) => {
      if (!id) {
        return;
      }
      const selected = libraryItems.find((item) => item.id === id);
      if (!selected) {
        return;
      }
      setRenameItemId(selected.id);
      setRenameItemName(selected.name ?? "");
    },
    [libraryItems],
  );

  const onItemClick = useCallback(
    (id: LibraryItem["id"] | null) => {
      if (id) {
        onInsertLibraryItems(getInsertedElements(id));
      }
    },
    [getInsertedElements, onInsertLibraryItems],
  );

  const visibleItemCount = filteredItems.length
    ? filteredItems.length
    : unpublishedItems.length + publishedItems.length;
  const itemsRenderedPerBatch =
    svgCache.size >= visibleItemCount
      ? CACHED_ITEMS_RENDERED_PER_BATCH
      : ITEMS_RENDERED_PER_BATCH;
  const canMoveSelectionHere = selectedItems.some((selectedId) => {
    const item = libraryItems.find((candidate) => candidate.id === selectedId);
    return item && !isSameLibraryFolder(item.folderPath, activeFolderPath);
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // focus could be stolen by tab trigger button
    nextAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  }, []);

  const JSX_whenNotSearching = !IS_SEARCHING && (
    <>
      <div className="library-folders-toolbar">
        <div className="library-folder-breadcrumbs" aria-label="Carpeta actual">
          <button type="button" onClick={() => setActiveFolderPath([])}>
            {t("library.folders.root")}
          </button>
          {activeFolderPath.map((folder, index) => (
            <React.Fragment
              key={libraryFolderPathKey(activeFolderPath.slice(0, index + 1))}
            >
              <span>/</span>
              <button
                type="button"
                onClick={() =>
                  setActiveFolderPath(activeFolderPath.slice(0, index + 1))
                }
              >
                {folder}
              </button>
            </React.Fragment>
          ))}
        </div>
        <div className="library-folder-actions">
          <button type="button" onClick={createFolder}>
            + {t("library.folders.new")}
          </button>
          {canMoveSelectionHere && (
            <button type="button" onClick={moveSelectedHere}>
              {t("library.folders.moveHere")} ({selectedItems.length})
            </button>
          )}
          {selectedItems.length === 1 && (
            <button type="button" onClick={() => renameItem(selectedItems[0])}>
              {t("library.folders.rename")}
            </button>
          )}
        </div>
      </div>

      {!!childFolders.length && (
        <div className="library-folder-grid">
          {childFolders.map((folder) => (
            <button
              key={folder}
              type="button"
              className="library-folder-card"
              onClick={() => setActiveFolderPath([...activeFolderPath, folder])}
            >
              <span aria-hidden="true">▰</span>
              <strong>{folder}</strong>
            </button>
          ))}
        </div>
      )}

      {!IS_LIBRARY_EMPTY && (
        <div className="library-menu-items-container__header">
          {t("labels.personalLib")}
        </div>
      )}
      {!pendingElements.length &&
      !unpublishedItems.length &&
      !childFolders.length ? (
        <div className="library-menu-items__no-items">
          {!publishedItems.length && (
            <div className="library-menu-items__no-items__label">
              {t("library.noItems")}
            </div>
          )}
          <div className="library-menu-items__no-items__hint">
            {publishedItems.length > 0
              ? t("library.hint_emptyPrivateLibrary")
              : activeFolderPath.length
              ? t("library.folders.empty")
              : t("library.hint_emptyLibrary")}
          </div>
        </div>
      ) : (
        <LibraryMenuSectionGrid>
          {pendingElements.length > 0 && (
            <LibraryMenuSection
              itemsRenderedPerBatch={itemsRenderedPerBatch}
              items={[{ id: null, elements: pendingElements }]}
              onItemSelectToggle={onItemSelectToggle}
              onItemDrag={onItemDrag}
              onClick={onAddToLibraryClick}
              isItemSelected={isItemSelected}
              svgCache={svgCache}
            />
          )}
          <LibraryMenuSection
            itemsRenderedPerBatch={itemsRenderedPerBatch}
            items={unpublishedItems}
            onItemSelectToggle={onItemSelectToggle}
            onItemDrag={onItemDrag}
            onItemRename={renameItem}
            onClick={onItemClick}
            isItemSelected={isItemSelected}
            svgCache={svgCache}
          />
        </LibraryMenuSectionGrid>
      )}

      {publishedItems.length > 0 && (
        <div
          className="library-menu-items-container__header"
          style={{ marginTop: "0.75rem" }}
        >
          {t("labels.excalidrawLib")}
        </div>
      )}
      {publishedItems.length > 0 && (
        <LibraryMenuSectionGrid>
          <LibraryMenuSection
            itemsRenderedPerBatch={itemsRenderedPerBatch}
            items={publishedItems}
            onItemSelectToggle={onItemSelectToggle}
            onItemDrag={onItemDrag}
            onItemRename={renameItem}
            onClick={onItemClick}
            isItemSelected={isItemSelected}
            svgCache={svgCache}
          />
        </LibraryMenuSectionGrid>
      )}
    </>
  );

  const JSX_whenSearching = IS_SEARCHING && (
    <>
      <div className="library-menu-items-container__header">
        {t("library.search.heading")}
        {!isLoading && (
          <div
            className="library-menu-items-container__header__hint"
            style={{ cursor: "pointer" }}
            onPointerDown={(e) => e.preventDefault()}
            onClick={(event) => {
              setSearchInputValue("");
            }}
          >
            <kbd>esc</kbd> to clear
          </div>
        )}
      </div>
      {filteredItems.length > 0 ? (
        <LibraryMenuSectionGrid>
          <LibraryMenuSection
            itemsRenderedPerBatch={itemsRenderedPerBatch}
            items={filteredItems}
            onItemSelectToggle={onItemSelectToggle}
            onItemDrag={onItemDrag}
            onItemRename={renameItem}
            onClick={onItemClick}
            isItemSelected={isItemSelected}
            svgCache={svgCache}
          />
        </LibraryMenuSectionGrid>
      ) : (
        <div className="library-menu-items__no-items">
          <div className="library-menu-items__no-items__hint">
            {t("library.search.noResults")}
          </div>
          <Button
            onPointerDown={(e) => e.preventDefault()}
            onSelect={() => {
              setSearchInputValue("");
            }}
            style={{ width: "auto", marginTop: "1rem" }}
          >
            {t("library.search.clearSearch")}
          </Button>
        </div>
      )}
    </>
  );

  return (
    <div
      className="library-menu-items-container"
      style={
        pendingElements.length ||
        unpublishedItems.length ||
        publishedItems.length
          ? { justifyContent: "flex-start" }
          : { borderBottom: 0 }
      }
    >
      <div className="library-menu-items-header">
        {!IS_LIBRARY_EMPTY && (
          <TextField
            ref={searchInputRef}
            type="search"
            className={clsx("library-menu-items-container__search", {
              hideCancelButton: editorInterface.formFactor !== "phone",
            })}
            placeholder={t("library.search.inputPlaceholder")}
            value={searchInputValue}
            onChange={(value) => setSearchInputValue(value)}
          />
        )}
        <LibraryDropdownMenu
          selectedItems={selectedItems}
          onSelectItems={onSelectItems}
          className="library-menu-dropdown-container--in-heading"
        />
      </div>
      <Stack.Col
        className="library-menu-items-container__items"
        align="start"
        gap={1}
        style={{ flex: 1, margin: 0 }}
        ref={libraryContainerRef}
      >
        {isLoading && (
          <div
            style={{
              position: "absolute",
              top: "var(--container-padding-y)",
              right: "var(--container-padding-x)",
              transform: "translateY(50%)",
            }}
          >
            <Spinner />
          </div>
        )}

        {JSX_whenNotSearching}
        {JSX_whenSearching}

        {IS_LIBRARY_EMPTY && (
          <LibraryMenuControlButtons
            style={{ padding: "16px 0", width: "100%" }}
            id={id}
            libraryReturnUrl={libraryReturnUrl}
            theme={theme}
          />
        )}
      </Stack.Col>
      {showNameDialog && (
        <Dialog
          title={t("library.naming.prompt")}
          size="small"
          onCloseRequest={() => setShowNameDialog(false)}
        >
          <form
            className="library-name-dialog"
            onSubmit={(event) => {
              event.preventDefault();
              if (!assetName.trim()) {
                return;
              }
              onAddToLibrary(
                pendingElements,
                assetName.trim(),
                activeFolderPath,
              );
              setShowNameDialog(false);
            }}
          >
            <label>
              {t("library.naming.prompt")}
              <input
                autoFocus
                value={assetName}
                onChange={(event) => setAssetName(event.target.value)}
                maxLength={120}
                required
              />
            </label>
            <p>
              {activeFolderPath.length
                ? activeFolderPath.join(" / ")
                : t("library.folders.root")}
            </p>
            <div>
              <button type="button" onClick={() => setShowNameDialog(false)}>
                {t("buttons.cancel")}
              </button>
              <button type="submit" disabled={!assetName.trim()}>
                {t("library.naming.add")}
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {showFolderDialog && (
        <Dialog
          title={t("library.folders.prompt")}
          size="small"
          onCloseRequest={() => setShowFolderDialog(false)}
        >
          <form
            className="library-name-dialog"
            onSubmit={(event) => {
              event.preventDefault();
              const normalizedName = normalizeLibraryFolderName(folderName);
              if (!normalizedName) {
                return;
              }
              const path = [...activeFolderPath, normalizedName];
              setCreatedFolderPaths((current) => {
                const key = libraryFolderPathKey(path);
                return current.some(
                  (folder) => libraryFolderPathKey(folder) === key,
                )
                  ? current
                  : [...current, path];
              });
              setActiveFolderPath(path);
              setShowFolderDialog(false);
            }}
          >
            <label>
              {t("library.folders.prompt")}
              <input
                autoFocus
                value={folderName}
                onChange={(event) => setFolderName(event.target.value)}
                maxLength={80}
                required
              />
            </label>
            <p>
              {activeFolderPath.length
                ? activeFolderPath.join(" / ")
                : t("library.folders.root")}
            </p>
            <div>
              <button type="button" onClick={() => setShowFolderDialog(false)}>
                {t("buttons.cancel")}
              </button>
              <button type="submit" disabled={!folderName.trim()}>
                {t("library.folders.create")}
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {renameItemId && (
        <Dialog
          title={t("library.naming.rename")}
          size="small"
          onCloseRequest={() => setRenameItemId(null)}
        >
          <form
            className="library-name-dialog"
            onSubmit={(event) => {
              event.preventDefault();
              if (!renameItemName.trim()) {
                return;
              }
              void app.library.setLibrary(
                libraryItems.map((item) =>
                  item.id === renameItemId
                    ? { ...item, name: renameItemName.trim() }
                    : item,
                ),
              );
              setRenameItemId(null);
            }}
          >
            <label>
              {t("library.naming.prompt")}
              <input
                autoFocus
                value={renameItemName}
                onChange={(event) => setRenameItemName(event.target.value)}
                maxLength={120}
                required
              />
            </label>
            <div>
              <button type="button" onClick={() => setRenameItemId(null)}>
                {t("buttons.cancel")}
              </button>
              <button type="submit" disabled={!renameItemName.trim()}>
                {t("library.folders.rename")}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
