import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { app, BrowserWindow, Menu, net, protocol, shell } from "electron";

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

const createApplicationMenu = () => {
  const template = [
    {
      label: app.name,
      submenu: [
        { role: "about" },
        {
          label: "Ver versión publicada en GitHub…",
          click: () =>
            shell.openExternal(
              "https://github.com/jonymillenium/excalidraw/commits/feature/workspaces-projects-views-security",
            ),
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
    title: "Xcalidraw",
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: "#1f1e24",
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
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

app.setName("Xcalidraw");
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
