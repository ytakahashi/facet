import { isImeProcessing } from "../isImeProcessing.ts";

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

export type EditorShortcut = "insert-link" | "indent" | "outdent";

export function resolveEditorShortcut(
  event: ShortcutEvent,
): EditorShortcut | undefined {
  if (isImeProcessing(event) || event.ctrlKey || event.altKey) {
    return undefined;
  }
  // Only bare Tab and Shift-Tab are claimed, so Control-Tab and Option-Tab
  // still move focus out of the editor without a pointer.
  if (event.key === "Tab" && !event.metaKey) {
    return event.shiftKey ? "outdent" : "indent";
  }
  // Command-K is the conventional link shortcut and does not collide with the
  // board or viewer shortcuts. Check both cases because Caps Lock can change
  // the reported key without adding the Shift modifier.
  if (
    event.metaKey &&
    !event.shiftKey &&
    (event.key === "k" || event.key === "K")
  ) {
    return "insert-link";
  }
  return undefined;
}
