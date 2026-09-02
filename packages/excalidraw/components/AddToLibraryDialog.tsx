import { useEffect, useState } from "react";

import { randomId } from "@excalidraw/common";

import {
  collectLibraryFolders,
  libraryFolderPathKey,
} from "../data/libraryFolders";
import { libraryItemsAtom } from "../data/library";
import { atom, useAtom } from "../editor-jotai";
import { t } from "../i18n";

import { useApp, useExcalidrawSetAppState } from "./App";
import { Dialog } from "./Dialog";

import "./LibraryMenuItems.scss";

import type { LibraryItem } from "../types";

export const addToLibraryDialogAtom = atom<LibraryItem["elements"] | null>(
  null,
);

export const AddToLibraryDialog = () => {
  const app = useApp();
  const setAppState = useExcalidrawSetAppState();
  const [pendingElements, setPendingElements] = useAtom(addToLibraryDialogAtom);
  const [libraryItemsData] = useAtom(libraryItemsAtom);
  const [name, setName] = useState("");
  const [folderKey, setFolderKey] = useState("");
  const [saving, setSaving] = useState(false);

  const folders = pendingElements
    ? collectLibraryFolders(libraryItemsData.libraryItems)
    : [];

  useEffect(() => {
    if (pendingElements) {
      setName(
        `${t("library.naming.defaultName")} ${
          libraryItemsData.libraryItems.length + 1
        }`,
      );
      setFolderKey("");
      setSaving(false);
    }
  }, [libraryItemsData.libraryItems.length, pendingElements]);

  if (!pendingElements) {
    return null;
  }

  const close = () => {
    if (!saving) {
      setPendingElements(null);
    }
  };

  return (
    <Dialog
      title={t("library.naming.prompt")}
      size="small"
      onCloseRequest={close}
    >
      <form
        className="library-name-dialog"
        onSubmit={(event) => {
          event.preventDefault();
          const nextName = name.trim();
          if (!nextName || saving) {
            return;
          }
          const folderPath =
            folders.find(
              (folder) => libraryFolderPathKey(folder) === folderKey,
            ) ?? [];
          setSaving(true);
          void app.library
            .getLatestLibrary()
            .then((items) =>
              app.library.setLibrary([
                {
                  id: randomId(),
                  status: "unpublished",
                  elements: pendingElements,
                  created: Date.now(),
                  name: nextName,
                  folderPath: [...folderPath],
                },
                ...items,
              ]),
            )
            .then(() => {
              setPendingElements(null);
              setAppState({
                toast: { message: t("toast.addedToLibrary") },
              });
            })
            .catch((error: Error) => {
              setSaving(false);
              setAppState({
                errorMessage: error.message || t("alerts.errorAddingToLibrary"),
              });
            });
        }}
      >
        <p>{t("library.naming.description")}</p>
        <label>
          {t("library.naming.prompt")}
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
            required
          />
        </label>
        <label>
          {t("library.folders.destination")}
          <select
            value={folderKey}
            onChange={(event) => setFolderKey(event.target.value)}
          >
            <option value="">{t("library.folders.root")}</option>
            {folders.map((folder) => (
              <option
                key={libraryFolderPathKey(folder)}
                value={libraryFolderPathKey(folder)}
              >
                {folder.join(" / ")}
              </option>
            ))}
          </select>
        </label>
        <div>
          <button type="button" onClick={close} disabled={saving}>
            {t("buttons.cancel")}
          </button>
          <button type="submit" disabled={!name.trim() || saving}>
            {saving ? `${t("library.naming.add")}…` : t("library.naming.add")}
          </button>
        </div>
      </form>
    </Dialog>
  );
};
