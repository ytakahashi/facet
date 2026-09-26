import { ClipboardError, type ClipboardPort } from "../domain/clipboardPort.ts";

export class WebClipboard implements ClipboardPort {
  async writeText(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
    } catch (cause) {
      throw new ClipboardError({ cause });
    }
  }
}
