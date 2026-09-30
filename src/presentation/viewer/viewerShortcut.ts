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

// WebKit can report the key that ends an IME composition with isComposing
// already false; keyCode 229 still marks it as consumed by the IME.
const IME_PROCESS_KEY_CODE = 229;

export function resolveViewerShortcut(
  event: ShortcutEvent,
): ViewerShortcut | undefined {
  if (event.isComposing || event.keyCode === IME_PROCESS_KEY_CODE) {
    return undefined;
  }
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
