import { isImeProcessing } from "../isImeProcessing.ts";

export type InlineEditShortcut = "commit" | "cancel";

// The keys of a single-line text input that commits on Enter and cancels on
// Escape. While an IME is converting, Enter confirms a candidate and Escape
// cancels the conversion, so neither is aimed at the edit.
export function resolveInlineEditShortcut(
  event: Pick<KeyboardEvent, "key" | "keyCode" | "isComposing">,
): InlineEditShortcut | undefined {
  if (isImeProcessing(event)) return undefined;

  if (event.key === "Enter") return "commit";
  return event.key === "Escape" ? "cancel" : undefined;
}
