import { useEffect, useMemo, useState } from "react";

import {
  CURATED_LIBRARY_CATEGORIES,
  filterCuratedLibraries,
  type CuratedLibrary,
  type CuratedLibraryCategory,
} from "../services/curatedLibraries";
import {
  searchIconifyAssets,
  searchUnsplashAssets,
  trackUnsplashDownload,
  type IconifyAsset,
  type UnsplashAsset,
} from "../services/publicAssets";

import { WorkspaceDialog } from "./WorkspaceDialog";

const UNSPLASH_ACCESS_KEY_STORAGE = "xcalidraw-unsplash-access-key";
const installedLibrariesStorage = (profileId: string) =>
  `xcalidraw-installed-libraries:${profileId}`;

const suggestedSearches = [
  ["Marketing", "business"],
  ["Redes sociales", "social media"],
  ["Lead magnets", "download gift"],
  ["Landing pages", "website"],
  ["Funnels", "filter flow"],
  ["Email", "email"],
  ["Analytics", "analytics"],
  ["Personas", "people"],
] as const;

const ICON_STYLES = {
  freehand: {
    label: "Freehand · dibujado a mano",
    prefixes: ["streamline-freehand"],
  },
  robust: {
    label: "Robusto · líneas pesadas",
    prefixes: ["streamline-plump", "streamline-sharp", "ph", "solar"],
  },
  minimal: {
    label: "Minimal · trazo limpio",
    prefixes: ["tabler", "lucide", "ph"],
  },
  curated: {
    label: "Todos los estilos recomendados",
    prefixes: [
      "streamline-freehand",
      "streamline-plump",
      "streamline-sharp",
      "tabler",
      "lucide",
      "ph",
      "solar",
      "streamline-logos",
    ],
  },
} as const;

type AssetTab = "icons" | "libraries" | "photos";
type IconStyle = keyof typeof ICON_STYLES;

export type PublicAssetSelection = {
  id: string;
  label: string;
  sourceUrl: string;
  baseSourceUrl?: string;
  kind: "icon" | "photo";
  iconColor?: string;
  followsCanvasColor?: boolean;
};

export const PublicAssetsDialog = ({
  profileId,
  defaultIconColor,
  onInsert,
  onInstallLibrary,
  onClose,
}: {
  profileId: string;
  defaultIconColor: string;
  onInsert: (selection: PublicAssetSelection) => Promise<void>;
  onInstallLibrary: (library: CuratedLibrary) => Promise<void>;
  onClose: () => void;
}) => {
  const [tab, setTab] = useState<AssetTab>("icons");
  const [query, setQuery] = useState("business");
  const [icons, setIcons] = useState<IconifyAsset[]>([]);
  const [photos, setPhotos] = useState<UnsplashAsset[]>([]);
  const [iconStyle, setIconStyle] = useState<IconStyle>("freehand");
  const [followsCanvasColor, setFollowsCanvasColor] = useState(true);
  const [iconColor, setIconColor] = useState(defaultIconColor);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [libraryCategory, setLibraryCategory] =
    useState<CuratedLibraryCategory>();
  const [installedLibraries, setInstalledLibraries] = useState<Set<string>>(
    () =>
      new Set(
        JSON.parse(
          window.localStorage.getItem(installedLibrariesStorage(profileId)) ??
            "[]",
        ) as string[],
      ),
  );
  const [accessKey, setAccessKey] = useState(
    () =>
      import.meta.env.VITE_APP_UNSPLASH_ACCESS_KEY ??
      window.localStorage.getItem(UNSPLASH_ACCESS_KEY_STORAGE) ??
      "",
  );
  const [loading, setLoading] = useState(false);
  const [insertingId, setInsertingId] = useState<string>();
  const [error, setError] = useState<string>();
  const resolvedIconColor = followsCanvasColor ? defaultIconColor : iconColor;
  const visibleLibraries = useMemo(
    () => filterCuratedLibraries(libraryQuery, libraryCategory),
    [libraryCategory, libraryQuery],
  );

  useEffect(() => {
    if (followsCanvasColor) {
      setIconColor(defaultIconColor);
    }
  }, [defaultIconColor, followsCanvasColor]);

  const runSearch = async (
    nextQuery = query,
    nextTab = tab,
    nextStyle = iconStyle,
  ) => {
    const normalizedQuery = nextQuery.trim();
    if (!normalizedQuery || nextTab === "libraries") {
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      if (nextTab === "icons") {
        setIcons(
          await searchIconifyAssets(normalizedQuery, {
            prefixes: [...ICON_STYLES[nextStyle].prefixes],
          }),
        );
      } else {
        if (!accessKey.trim()) {
          throw new Error(
            "Añade una Access Key de Unsplash para buscar fotografías.",
          );
        }
        window.localStorage.setItem(
          UNSPLASH_ACCESS_KEY_STORAGE,
          accessKey.trim(),
        );
        setPhotos(
          await searchUnsplashAssets(normalizedQuery, accessKey.trim()),
        );
      }
    } catch (searchError) {
      setError(
        searchError instanceof Error
          ? searchError.message
          : "No se pudieron cargar los recursos.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void runSearch("business", "icons", "freehand");
    // This initial search must run once when the library opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const insertIcon = async (asset: IconifyAsset) => {
    setInsertingId(asset.id);
    setError(undefined);
    try {
      await onInsert({
        id: asset.id,
        label: asset.name.replaceAll("-", " "),
        sourceUrl: `${asset.sourceUrl}?color=${encodeURIComponent(
          resolvedIconColor,
        )}`,
        baseSourceUrl: asset.sourceUrl,
        iconColor: resolvedIconColor,
        followsCanvasColor,
        kind: "icon",
      });
      onClose();
    } catch (insertError) {
      setError(
        insertError instanceof Error
          ? insertError.message
          : "No se pudo insertar el icono.",
      );
    } finally {
      setInsertingId(undefined);
    }
  };

  const installLibrary = async (library: CuratedLibrary) => {
    setInsertingId(library.id);
    setError(undefined);
    try {
      await onInstallLibrary(library);
      const next = new Set(installedLibraries).add(library.id);
      setInstalledLibraries(next);
      window.localStorage.setItem(
        installedLibrariesStorage(profileId),
        JSON.stringify([...next]),
      );
      onClose();
    } catch (installError) {
      setError(
        installError instanceof Error
          ? installError.message
          : "No se pudo instalar la librería.",
      );
    } finally {
      setInsertingId(undefined);
    }
  };

  const insertPhoto = async (asset: UnsplashAsset) => {
    setInsertingId(asset.id);
    setError(undefined);
    try {
      await trackUnsplashDownload(asset.downloadLocation, accessKey);
      await onInsert({
        id: asset.id,
        label: asset.description,
        sourceUrl: asset.sourceUrl,
        kind: "photo",
      });
      onClose();
    } catch (insertError) {
      setError(
        insertError instanceof Error
          ? insertError.message
          : "No se pudo insertar la fotografía.",
      );
    } finally {
      setInsertingId(undefined);
    }
  };

  return (
    <WorkspaceDialog
      title="Recursos visuales"
      description="Iconos Freehand y robustos, packs nativos editables y fotografías. Busca en castellano o en inglés."
      size="wide"
      onClose={onClose}
    >
      <div className="public-assets">
        <div className="public-assets__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "icons"}
            className={tab === "icons" ? "is-active" : ""}
            onClick={() => setTab("icons")}
          >
            Iconos · Iconify
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "libraries"}
            className={tab === "libraries" ? "is-active" : ""}
            onClick={() => setTab("libraries")}
          >
            Packs nativos · 17
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "photos"}
            className={tab === "photos" ? "is-active" : ""}
            onClick={() => setTab("photos")}
          >
            Fotos · Unsplash
          </button>
        </div>

        {tab === "photos" && (
          <label className="public-assets__access-key">
            <span>Unsplash Access Key</span>
            <input
              type="password"
              value={accessKey}
              onChange={(event) => setAccessKey(event.target.value)}
              placeholder="Pega tu Access Key (no la Secret Key)"
              autoComplete="off"
            />
            <small>
              Se guarda solo en esta Mac. Nunca pegues aquí la Secret Key.
            </small>
          </label>
        )}

        {tab === "icons" && (
          <div className="public-assets__icon-controls">
            <label>
              <span>Estilo</span>
              <select
                value={iconStyle}
                onChange={(event) => {
                  const nextStyle = event.target.value as IconStyle;
                  setIconStyle(nextStyle);
                  void runSearch(query, "icons", nextStyle);
                }}
              >
                {Object.entries(ICON_STYLES).map(([id, style]) => (
                  <option key={id} value={id}>
                    {style.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="public-assets__canvas-color">
              <input
                type="checkbox"
                checked={followsCanvasColor}
                onChange={(event) =>
                  setFollowsCanvasColor(event.target.checked)
                }
              />
              <span>Usar color de trazo del lienzo</span>
            </label>
            <label className="public-assets__icon-color">
              <span>Color</span>
              <input
                type="color"
                value={resolvedIconColor}
                disabled={followsCanvasColor}
                onChange={(event) => setIconColor(event.target.value)}
                aria-label="Color del icono"
              />
              <output>{resolvedIconColor.toUpperCase()}</output>
            </label>
          </div>
        )}

        {tab !== "libraries" ? (
          <form
            className="public-assets__search"
            onSubmit={(event) => {
              event.preventDefault();
              void runSearch();
            }}
          >
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={
                tab === "icons"
                  ? "Ej. email, target, website, analytics…"
                  : "Ej. oficina, producto, equipo…"
              }
              aria-label="Buscar recursos"
            />
            <button
              type="submit"
              className="workspace-button workspace-button--primary"
              disabled={loading}
            >
              {loading ? "Buscando…" : "Buscar"}
            </button>
          </form>
        ) : (
          <input
            className="public-assets__library-search"
            type="search"
            value={libraryQuery}
            onChange={(event) => setLibraryQuery(event.target.value)}
            placeholder="Buscar packs: marketing, formularios, personas, código…"
            aria-label="Buscar packs nativos"
          />
        )}

        {tab === "libraries" ? (
          <div className="public-assets__suggestions" aria-label="Categorías">
            <button
              type="button"
              className={!libraryCategory ? "is-active" : ""}
              onClick={() => setLibraryCategory(undefined)}
            >
              Todas
            </button>
            {CURATED_LIBRARY_CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                className={libraryCategory === category ? "is-active" : ""}
                onClick={() => setLibraryCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
        ) : (
          <div className="public-assets__suggestions" aria-label="Sugerencias">
            {suggestedSearches.map(([label, search]) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setQuery(search);
                  void runSearch(search);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {tab === "icons" && iconStyle === "freehand" && (
          <p className="public-assets__attribution">
            Streamline Freehand vía Iconify · CC BY 4.0. Los demás estilos
            muestran su licencia en cada resultado.
          </p>
        )}

        {error && (
          <div className="workspace-alert workspace-alert--error" role="alert">
            {error}
          </div>
        )}

        <div
          className={`public-assets__grid public-assets__grid--${tab}`}
          aria-live="polite"
        >
          {tab === "icons" &&
            icons.map((asset) => (
              <button
                key={asset.id}
                type="button"
                className="public-asset-card public-asset-card--icon"
                disabled={!!insertingId}
                onClick={() => void insertIcon(asset)}
                title={`Insertar ${asset.name}`}
              >
                <span>
                  <img
                    src={`${asset.previewUrl}?color=${encodeURIComponent(
                      resolvedIconColor,
                    )}`}
                    alt=""
                    loading="lazy"
                  />
                </span>
                <strong>{asset.name.replaceAll("-", " ")}</strong>
                <small>
                  {asset.collection}
                  {asset.license ? ` · ${asset.license}` : ""}
                </small>
              </button>
            ))}
          {tab === "libraries" &&
            visibleLibraries.map((item) => (
              <article key={item.id} className="public-library-card">
                <div
                  className="public-library-card__preview"
                  aria-hidden="true"
                >
                  <span />
                  <span />
                  <span />
                </div>
                <div className="public-library-card__content">
                  <small>{item.category}</small>
                  <strong>{item.name}</strong>
                  <p>{item.description}</p>
                  <div>
                    <span>{item.itemCount} elementos editables</span>
                    <button
                      type="button"
                      className="workspace-button workspace-button--primary"
                      disabled={!!insertingId}
                      onClick={() => void installLibrary(item)}
                    >
                      {insertingId === item.id
                        ? "Instalando…"
                        : installedLibraries.has(item.id)
                        ? "Reinstalar"
                        : "Instalar"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          {tab === "photos" &&
            photos.map((asset) => (
              <article key={asset.id} className="public-asset-card">
                <button
                  type="button"
                  disabled={!!insertingId}
                  onClick={() => void insertPhoto(asset)}
                  title={`Insertar ${asset.description}`}
                >
                  <img
                    src={asset.previewUrl}
                    alt={asset.description}
                    loading="lazy"
                  />
                </button>
                <div>
                  <span>Foto de </span>
                  <a
                    href={asset.photographerUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {asset.photographerName}
                  </a>
                  <span> en </span>
                  <a href={asset.photoUrl} target="_blank" rel="noreferrer">
                    Unsplash
                  </a>
                </div>
              </article>
            ))}
          {!loading &&
            ((tab === "icons" && !icons.length) ||
              (tab === "libraries" && !visibleLibraries.length) ||
              (tab === "photos" && !photos.length)) && (
              <p className="public-assets__empty">
                No encontramos recursos para esta búsqueda.
              </p>
            )}
        </div>
      </div>
    </WorkspaceDialog>
  );
};
