type ShortcutEvent = Pick<
  KeyboardEvent,
  | "key"
  | "metaKey"
  | "ctrlKey"
  | "altKey"
  | "shiftKey"
  | "isComposing"
>;

// Command-K is the conventional link shortcut and does not collide with the
// board or viewer shortcuts. Check both cases because Caps Lock can change the
// reported key without adding the Shift modifier.
export function resolveEditorShortcut(
  event: ShortcutEvent,
): "insert-link" | undefined {
  if (
    event.isComposing || !event.metaKey || event.ctrlKey || event.altKey ||
    event.shiftKey
  ) {
    return undefined;
  }
  return event.key === "k" || event.key === "K" ? "insert-link" : undefined;
}
