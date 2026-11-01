import { isImeProcessing } from "../isImeProcessing.ts";

export type ResultListShortcut = "next" | "previous" | "confirm";

// The keys of a dialog that pairs a text input with a list of results. While
// an IME is converting, Enter confirms a candidate and the arrow keys move
// through candidates, so none of them are aimed at the list.
export function resolveResultListShortcut(
  event: Pick<KeyboardEvent, "key" | "keyCode" | "isComposing">,
): ResultListShortcut | undefined {
  if (isImeProcessing(event)) return undefined;

  if (event.key === "ArrowDown") return "next";
  if (event.key === "ArrowUp") return "previous";
  return event.key === "Enter" ? "confirm" : undefined;
}
