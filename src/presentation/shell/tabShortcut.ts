import { isImeProcessing } from "../shared/isImeProcessing.ts";

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

export function resolveTabShortcut(event: ShortcutEvent): number | undefined {
  if (isImeProcessing(event)) return undefined;
  if (!event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
    return undefined;
  }
  return /^[1-9]$/.test(event.key) ? Number(event.key) - 1 : undefined;
}
