const RELEASE_DOWNLOAD_PREFIX = "/jonymillenium/excalidraw/releases/download/";
const DMG_NAME = /^Xcalidraw-\d+\.\d+\.\d+-arm64\.dmg$/;

export const resolveDesktopUpdateDownload = ({ downloadUrl, assetName }) => {
  if (typeof downloadUrl !== "string" || typeof assetName !== "string") {
    throw new Error("La actualización recibida no es válida.");
  }
  if (!DMG_NAME.test(assetName)) {
    throw new Error("El instalador no tiene el nombre esperado.");
  }

  let url;
  try {
    url = new URL(downloadUrl);
  } catch {
    throw new Error("La dirección del instalador no es válida.");
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== "github.com" ||
    !url.pathname.startsWith(RELEASE_DOWNLOAD_PREFIX) ||
    !url.pathname.endsWith(`/${assetName}`)
  ) {
    throw new Error("El instalador no pertenece al repositorio autorizado.");
  }

  return { downloadUrl: url.href, assetName };
};
