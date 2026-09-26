import type { ClipboardPort } from "../domain/clipboardPort.ts";
import { UseCaseError } from "./useCaseError.ts";

export async function copyToClipboard(
  text: string,
  { clipboard }: { clipboard: ClipboardPort },
): Promise<void> {
  try {
    await clipboard.writeText(text);
  } catch (cause) {
    throw new UseCaseError("clipboard.write-failed", {}, { cause });
  }
}
