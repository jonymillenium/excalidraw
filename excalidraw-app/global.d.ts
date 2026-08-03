import "@excalidraw/excalidraw/global";
import "@excalidraw/excalidraw/css";

declare global {
  interface Window {
    __EXCALIDRAW_SHA__: string | undefined;
    xcalidrawDesktop?: {
      downloadUpdate: (request: {
        downloadUrl: string;
        assetName: string;
      }) => Promise<
        { state: "canceled" } | { state: "downloaded"; filePath: string }
      >;
    };
  }
}
