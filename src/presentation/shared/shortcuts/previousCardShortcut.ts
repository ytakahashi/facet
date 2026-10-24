import { isImeProcessing } from "../isImeProcessing.ts";
import { isTextEditingTarget } from "../isTextEditingTarget.ts";

export function resolvePreviousCardShortcut(
  event: Pick<
    KeyboardEvent,
    | "key"
    | "keyCode"
    | "metaKey"
    | "ctrlKey"
    | "altKey"
    | "shiftKey"
    | "isComposing"
  >,
): boolean {
  return (
    event.key === "[" &&
    event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.shiftKey &&
    !isImeProcessing(event)
  );
}

// Inline fields (board, column and card names, find) keep their edit in place.
// The Markdown editor is the exception: leaving it goes through selectCard's
// unsaved-draft confirmation, so switching from there loses nothing.
export function canSwitchCardFrom(target: EventTarget | null): boolean {
  if (!isTextEditingTarget(target)) return true;
  return (
    target instanceof Element &&
    target.closest("[data-markdown-editor]") !== null
  );
}
