const ICONIFY_ENDPOINT = "https://api.iconify.design";
const UNSPLASH_ENDPOINT = "https://api.unsplash.com";

const SPANISH_SEARCH_TERMS: Record<string, string> = {
  anuncio: "advertising",
  anuncios: "advertising",
  calendario: "calendar",
  campaña: "campaign",
  campañas: "campaign",
  carrito: "shopping cart",
  casa: "home",
  cliente: "customer",
  clientes: "customers",
  compra: "shopping",
  correo: "email",
  descarga: "download",
  embudo: "funnel",
  enlace: "link",
  equipo: "team",
  gráfico: "chart",
  imagen: "image",
  inicio: "home",
  mensaje: "message",
  marketing: "business",
  negocio: "business",
  notificación: "notification",
  página: "web page",
  perfil: "profile",
  persona: "person",
  personas: "people",
  red: "network",
  redes: "social media",
  sitio: "website",
  tienda: "store",
  usuario: "user",
  usuarios: "users",
  venta: "sales",
  ventas: "sales",
};

const SPANISH_SEARCH_PHRASES: Record<string, string> = {
  "redes sociales": "social media",
  "pagina web": "website",
  "pagina de aterrizaje": "landing page",
  "iman de prospectos": "lead magnet",
};

const normalizeSearchToken = (token: string) =>
  token
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();

export const translateAssetSearch = (query: string) => {
  const trimmed = query.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return "";
  }
  const normalizedQuery = normalizeSearchToken(trimmed);
  if (SPANISH_SEARCH_PHRASES[normalizedQuery]) {
    return SPANISH_SEARCH_PHRASES[normalizedQuery];
  }
  return trimmed
    .split(" ")
    .map((token) => {
      const normalized = normalizeSearchToken(token);
      const matchingKey = Object.keys(SPANISH_SEARCH_TERMS).find(
        (key) => normalizeSearchToken(key) === normalized,
      );
      return matchingKey ? SPANISH_SEARCH_TERMS[matchingKey] : token;
    })
    .join(" ");
};

export type IconifyAsset = {
  id: string;
  name: string;
  collection: string;
  previewUrl: string;
  sourceUrl: string;
  author?: string;
  license?: string;
};

export type UnsplashAsset = {
  id: string;
  description: string;
  previewUrl: string;
  sourceUrl: string;
  downloadLocation: string;
  photographerName: string;
  photographerUrl: string;
  photoUrl: string;
};

type IconifySearchResponse = {
  icons?: string[];
  collections?: Record<
    string,
    {
      name?: string;
      author?: { name?: string };
      license?: { title?: string; spdx?: string };
    }
  >;
};

type UnsplashSearchResponse = {
  results?: Array<{
    id: string;
    alt_description?: string | null;
    description?: string | null;
    urls?: { small?: string; regular?: string };
    links?: { html?: string; download_location?: string };
    user?: { name?: string; links?: { html?: string } };
  }>;
};

const assertResponse = (response: Response, provider: string) => {
  if (!response.ok) {
    throw new Error(
      `${provider} respondió ${response.status}. Intenta nuevamente.`,
    );
  }
};

export const searchIconifyAssets = async (
  query: string,
  options: { prefixes?: string[] } = {},
  fetcher: typeof fetch = fetch,
): Promise<IconifyAsset[]> => {
  const translatedQuery = translateAssetSearch(query);
  if (!translatedQuery) {
    return [];
  }
  const url = new URL(`${ICONIFY_ENDPOINT}/search`);
  url.searchParams.set("query", translatedQuery);
  url.searchParams.set("limit", "96");
  if (options.prefixes?.length) {
    url.searchParams.set("prefixes", options.prefixes.join(","));
  }
  const response = await fetcher(url);
  assertResponse(response, "Iconify");
  const payload = (await response.json()) as IconifySearchResponse;
  return (payload.icons ?? []).flatMap((id) => {
    const separator = id.indexOf(":");
    if (separator < 1) {
      return [];
    }
    const collection = id.slice(0, separator);
    const name = id.slice(separator + 1);
    const collectionInfo = payload.collections?.[collection];
    const sourceUrl = `${ICONIFY_ENDPOINT}/${encodeURIComponent(
      collection,
    )}/${encodeURIComponent(name)}.svg`;
    return [
      {
        id,
        name,
        collection: collectionInfo?.name ?? collection,
        previewUrl: sourceUrl,
        sourceUrl,
        author: collectionInfo?.author?.name,
        license:
          collectionInfo?.license?.spdx ?? collectionInfo?.license?.title,
      },
    ];
  });
};

const unsplashHeaders = (accessKey: string) => ({
  Authorization: `Client-ID ${accessKey.trim()}`,
  "Accept-Version": "v1",
});

export const searchUnsplashAssets = async (
  query: string,
  accessKey: string,
  fetcher: typeof fetch = fetch,
): Promise<UnsplashAsset[]> => {
  const translatedQuery = translateAssetSearch(query);
  if (!translatedQuery || !accessKey.trim()) {
    return [];
  }
  const url = new URL(`${UNSPLASH_ENDPOINT}/search/photos`);
  url.searchParams.set("query", translatedQuery);
  url.searchParams.set("per_page", "30");
  url.searchParams.set("content_filter", "high");
  const response = await fetcher(url, {
    headers: unsplashHeaders(accessKey),
  });
  assertResponse(response, "Unsplash");
  const payload = (await response.json()) as UnsplashSearchResponse;
  return (payload.results ?? []).flatMap((photo) => {
    if (
      !photo.urls?.small ||
      !photo.urls.regular ||
      !photo.links?.download_location ||
      !photo.links.html ||
      !photo.user?.name ||
      !photo.user.links?.html
    ) {
      return [];
    }
    return [
      {
        id: photo.id,
        description:
          photo.alt_description ?? photo.description ?? "Foto de Unsplash",
        previewUrl: photo.urls.small,
        sourceUrl: photo.urls.regular,
        downloadLocation: photo.links.download_location,
        photographerName: photo.user.name,
        photographerUrl: `${photo.user.links.html}?utm_source=xcalidraw_by_kurk&utm_medium=referral`,
        photoUrl: `${photo.links.html}?utm_source=xcalidraw_by_kurk&utm_medium=referral`,
      },
    ];
  });
};

export const trackUnsplashDownload = async (
  downloadLocation: string,
  accessKey: string,
  fetcher: typeof fetch = fetch,
) => {
  const response = await fetcher(downloadLocation, {
    headers: unsplashHeaders(accessKey),
  });
  assertResponse(response, "Unsplash");
};
