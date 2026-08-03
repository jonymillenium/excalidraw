import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("xcalidrawDesktop", {
  downloadUpdate: (request) =>
    ipcRenderer.invoke("xcalidraw:download-update", request),
});
