export type BoardSearchShortcut = "title" | "content";

type ShortcutEvent = Pick<
  KeyboardEvent,
  "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey"
>;

// Search shortcuts share the Command-only modifier rule, then use Shift to
// distinguish their intentionally separate entry points. Letter case is not
// trusted because Caps Lock can change it independently of Shift.
export function resolveBoardSearchShortcut(
  event: ShortcutEvent,
): BoardSearchShortcut | undefined {
  if (!event.metaKey || event.ctrlKey || event.altKey) return undefined;

  if (
    !event.shiftKey && (event.key === "p" || event.key === "P")
  ) {
    return "title";
  }
  if (event.shiftKey && (event.key === "f" || event.key === "F")) {
    return "content";
  }
  return undefined;
}
