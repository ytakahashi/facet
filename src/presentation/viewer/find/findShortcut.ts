import { isImeProcessing } from "../../shared/isImeProcessing.ts";

export function resolveFindShortcut(
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
): "next" | "previous" | "close" | undefined {
  if (
    isImeProcessing(event) || event.metaKey || event.ctrlKey || event.altKey
  ) return undefined;
  if (event.key === "Enter") return event.shiftKey ? "previous" : "next";
  return event.key === "Escape" && !event.shiftKey ? "close" : undefined;
}
