export type ViewerShortcut = "back";

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
  return event.key === "[" ? "back" : undefined;
}
