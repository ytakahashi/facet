import { isImeProcessing } from "../isImeProcessing.ts";

export function resolveHelpShortcut(
  event: Pick<
    KeyboardEvent,
    "key" | "keyCode" | "isComposing" | "metaKey" | "ctrlKey" | "altKey"
  >,
): boolean {
  // Shift produces "?" on common layouts, so only the reported key matters.
  return event.key === "?" && !event.metaKey && !event.ctrlKey &&
    !event.altKey && !isImeProcessing(event);
}
