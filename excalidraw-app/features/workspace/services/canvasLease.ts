type LeaseMessage =
  | { type: "claim"; tabId: string }
  | { type: "owned"; tabId: string }
  | { type: "release"; tabId: string };

const TAB_ID =
  globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);

export class CanvasLease {
  private channel: BroadcastChannel | null = null;
  private owned = false;

  async acquire(canvasId: string) {
    if (!("BroadcastChannel" in globalThis)) {
      this.owned = true;
      return true;
    }
    this.release();
    const channel = new BroadcastChannel(`workspace-canvas:${canvasId}`);
    this.channel = channel;
    let busy = false;
    channel.onmessage = (event: MessageEvent<LeaseMessage>) => {
      const message = event.data;
      if (message.tabId === TAB_ID) {
        return;
      }
      if (message.type === "claim" && this.owned) {
        const response: LeaseMessage = { type: "owned", tabId: TAB_ID };
        channel.postMessage(response);
      }
      if (message.type === "owned") {
        busy = true;
      }
    };
    const claim: LeaseMessage = { type: "claim", tabId: TAB_ID };
    channel.postMessage(claim);
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    this.owned = !busy;
    return this.owned;
  }

  release() {
    if (this.channel) {
      if (this.owned) {
        const release: LeaseMessage = {
          type: "release",
          tabId: TAB_ID,
        };
        this.channel.postMessage(release);
      }
      this.channel.close();
    }
    this.channel = null;
    this.owned = false;
  }
}
