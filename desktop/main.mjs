import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import electronUpdater from "electron-updater";

import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  net,
  protocol,
  shell,
} from "electron";

const { autoUpdater } = electronUpdater;
const UPDATE_RELEASES_URL =
  "https://github.com/jonymillenium/excalidraw/releases";
const UPDATE_FEED = {
  provider: "github",
  owner: "jonymillenium",
  repo: "excalidraw",
};

protocol.registerSchemesAsPrivileged([
  {
    scheme: "xcalidraw",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const applicationRoot = app.isPackaged
  ? path.join(process.resourcesPath, "app")
  : path.resolve(currentDirectory, "../excalidraw-app/build");

const resolveApplicationFile = (requestUrl) => {
  const url = new URL(requestUrl);
  const requested = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  const candidate = path.resolve(applicationRoot, requested || "index.html");
  const insideRoot =
    candidate === applicationRoot ||
    candidate.startsWith(`${applicationRoot}${path.sep}`);

  if (insideRoot && existsSync(candidate) && statSync(candidate).isFile()) {
    return candidate;
  }
  return path.join(applicationRoot, "index.html");
};

const installApplicationProtocol = () =>
  protocol.handle("xcalidraw", (request) =>
    net.fetch(pathToFileURL(resolveApplicationFile(request.url)).toString()),
  );

const assertTrustedUpdateSender = (event) => {
  const senderWindow = BrowserWindow.fromWebContents(event.sender);
  if (!senderWindow || !event.sender.getURL().startsWith("xcalidraw://app/")) {
    throw new Error("La actualización solo está disponible dentro de la app.");
  }
};

let desktopUpdateStatus = {
  state: "idle",
  version: app.getVersion(),
};

const publishDesktopUpdateStatus = (status) => {
  desktopUpdateStatus = status;
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("xcalidraw:update-status", status);
  }
};

const installDesktopUpdateHandler = () => {
  autoUpdater.setFeedURL(UPDATE_FEED);
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    publishDesktopUpdateStatus({ state: "checking" });
  });
  autoUpdater.on("update-available", (info) => {
    publishDesktopUpdateStatus({
      state: "available",
      version: app.getVersion(),
      latestVersion: info.version,
      url: UPDATE_RELEASES_URL,
    });
  });
  autoUpdater.on("update-not-available", () => {
    publishDesktopUpdateStatus({
      state: "current",
      version: app.getVersion(),
      commit: "",
    });
  });
  autoUpdater.on("download-progress", (progress) => {
    publishDesktopUpdateStatus({
      state: "downloading",
      version: app.getVersion(),
      latestVersion:
        "latestVersion" in desktopUpdateStatus
          ? desktopUpdateStatus.latestVersion
          : "",
      progress: Math.round(progress.percent),
    });
  });
  autoUpdater.on("update-downloaded", (info) => {
    publishDesktopUpdateStatus({
      state: "downloaded",
      version: app.getVersion(),
      latestVersion: info.version,
    });
  });
  autoUpdater.on("error", (error) => {
    publishDesktopUpdateStatus({
      state: "error",
      version: app.getVersion(),
      message: error.message || "No se pudo actualizar la aplicación.",
    });
  });

  ipcMain.handle("xcalidraw:check-for-updates", async (event) => {
    assertTrustedUpdateSender(event);
    if (!app.isPackaged) {
      return { state: "development", version: app.getVersion() };
    }
    await autoUpdater.checkForUpdates();
    return desktopUpdateStatus;
  });

  ipcMain.handle("xcalidraw:download-update", async (event) => {
    assertTrustedUpdateSender(event);
    if (desktopUpdateStatus.state !== "available") {
      throw new Error("No hay una actualización lista para descargar.");
    }
    await autoUpdater.downloadUpdate();
    return desktopUpdateStatus;
  });

  ipcMain.handle("xcalidraw:install-update", async (event) => {
    assertTrustedUpdateSender(event);
    if (desktopUpdateStatus.state !== "downloaded") {
      throw new Error("La actualización todavía no terminó de descargarse.");
    }
    const restartingStatus = {
      state: "restarting",
      version: app.getVersion(),
      latestVersion: desktopUpdateStatus.latestVersion,
    };
    setImmediate(() => autoUpdater.quitAndInstall(false, true));
    return restartingStatus;
  });
};

const createApplicationMenu = () => {
  const template = [
    {
      label: app.name,
      submenu: [
        { role: "about" },
        {
          label: "Ver versiones publicadas en GitHub…",
          click: () => shell.openExternal(UPDATE_RELEASES_URL),
        },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Edición",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "Visualización",
      submenu: [
        { role: "reload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Ventana",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        { role: "close" },
        { type: "separator" },
        { role: "front" },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
};

const createWindow = () => {
  const window = new BrowserWindow({
    title: "Xcalidraw by Kurk",
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: "#1f1e24",
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(currentDirectory, "preload.mjs"),
      sandbox: true,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("xcalidraw://")) {
      event.preventDefault();
      if (url.startsWith("https://") || url.startsWith("http://")) {
        void shell.openExternal(url);
      }
    }
  });
  window.once("ready-to-show", () => window.show());
  void window.loadURL("xcalidraw://app/");
  return window;
};

// Keep the original data directory so the product rename never hides profiles.
app.setPath("userData", path.join(app.getPath("appData"), "Xcalidraw"));
app.setName("Xcalidraw by Kurk");
const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const window = BrowserWindow.getAllWindows()[0];
    if (window) {
      if (window.isMinimized()) {
        window.restore();
      }
      window.focus();
    }
  });

  app.whenReady().then(() => {
    installApplicationProtocol();
    installDesktopUpdateHandler();
    createApplicationMenu();
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}
