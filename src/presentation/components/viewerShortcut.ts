export type ViewerShortcut = "back" | "save";

type ShortcutEvent = Pick<
  KeyboardEvent,
  | "key"
  | "metaKey"
  | "ctrlKey"
  | "altKey"
  | "shiftKey"
  | "isComposing"
>;

export function resolveViewerShortcut(
  event: ShortcutEvent,
): ViewerShortcut | undefined {
  if (
    event.isComposing || !event.metaKey || event.ctrlKey || event.altKey ||
    event.shiftKey
  ) {
    return undefined;
  }
  if (event.key === "[") return "back";
  // Caps Lock can change the reported case without adding Shift.
  return event.key === "s" || event.key === "S" ? "save" : undefined;
}
