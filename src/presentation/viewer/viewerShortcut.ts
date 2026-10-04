import { isImeProcessing } from "../shared/isImeProcessing.ts";

export type ViewerShortcut = "back" | "save" | "close" | "toggle-mode";

type ShortcutEvent = Pick<
  KeyboardEvent,
  | "key"
  | "keyCode"
  | "metaKey"
  | "ctrlKey"
  | "altKey"
  | "shiftKey"
  | "isComposing"
>;

export function resolveViewerShortcut(
  event: ShortcutEvent,
): ViewerShortcut | undefined {
  if (isImeProcessing(event)) return undefined;
  if (event.key === "Escape") {
    const hasModifier = event.metaKey || event.ctrlKey || event.altKey ||
      event.shiftKey;
    return hasModifier ? undefined : "close";
  }
  if (!event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
    return undefined;
  }
  if (event.key === "[") return "back";
  // Caps Lock can change the reported case without adding Shift.
  if (event.key === "s" || event.key === "S") return "save";
  return event.key === "e" || event.key === "E" ? "toggle-mode" : undefined;
}
