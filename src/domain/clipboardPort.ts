export interface ClipboardPort {
  writeText(text: string): Promise<void>;
}

export class ClipboardError extends Error {
  readonly kind = "write-failed";

  constructor(options?: ErrorOptions) {
    super("clipboard:write-failed", options);
    this.name = "ClipboardError";
  }
}
