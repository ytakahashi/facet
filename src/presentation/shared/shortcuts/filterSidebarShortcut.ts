import { isImeProcessing } from "../isImeProcessing.ts";

// Command-B follows the common editor convention for toggling a sidebar. The
// Markdown editor is a plain textarea with no default action for it, so it is
// claimed even while text is being edited. Check both cases because Caps Lock
// can change the reported key without adding the Shift modifier.
export function resolveFilterSidebarShortcut(
  event: Pick<
    KeyboardEvent,
    | "key"
    | "keyCode"
    | "isComposing"
    | "metaKey"
    | "ctrlKey"
    | "altKey"
    | "shiftKey"
  >,
): boolean {
  if (
    isImeProcessing(event) ||
    !event.metaKey ||
    event.ctrlKey ||
    event.altKey ||
    event.shiftKey
  ) {
    return false;
  }
  return event.key === "b" || event.key === "B";
}
