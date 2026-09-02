import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("xcalidrawDesktop", {
  checkForUpdates: () => ipcRenderer.invoke("xcalidraw:check-for-updates"),
  downloadUpdate: () => ipcRenderer.invoke("xcalidraw:download-update"),
  installUpdate: () => ipcRenderer.invoke("xcalidraw:install-update"),
  onUpdateStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on("xcalidraw:update-status", listener);
    return () => ipcRenderer.removeListener("xcalidraw:update-status", listener);
  },
});
