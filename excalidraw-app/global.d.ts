import "@excalidraw/excalidraw/global";
import "@excalidraw/excalidraw/css";

import type { ApplicationUpdateStatus } from "./features/workspace/services/updateChecker";

declare global {
  interface Window {
    __EXCALIDRAW_SHA__: string | undefined;
    xcalidrawDesktop?: {
      checkForUpdates: () => Promise<ApplicationUpdateStatus>;
      downloadUpdate: () => Promise<ApplicationUpdateStatus>;
      installUpdate: () => Promise<
        Extract<ApplicationUpdateStatus, { state: "restarting" }>
      >;
      onUpdateStatus: (
        callback: (status: ApplicationUpdateStatus) => void,
      ) => () => void;
    };
  }
}
