import { isImeProcessing } from "../isImeProcessing.ts";
import { isTextEditingTarget } from "../isTextEditingTarget.ts";

export type CardMoveDirection = "up" | "down";

// Option-Up/Down moves the caret by paragraph in text fields, so those keys
// are left unrecognised there rather than claimed and dropped.
export function resolveCardMoveShortcut(
  event: Pick<
    KeyboardEvent,
    | "key"
    | "keyCode"
    | "metaKey"
    | "ctrlKey"
    | "altKey"
    | "shiftKey"
    | "isComposing"
    | "target"
  >,
): CardMoveDirection | undefined {
  if (
    !event.altKey ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    isImeProcessing(event) ||
    isTextEditingTarget(event.target)
  ) {
    return undefined;
  }
  if (event.key === "ArrowUp") return "up";
  if (event.key === "ArrowDown") return "down";
  return undefined;
}
