import type { ContextMenuEntry } from "../context/appContext.ts";

export interface ColumnContextMenuActions {
  addCard: () => void;
  rename: () => void;
}

export function buildColumnContextMenu(
  actions: ColumnContextMenuActions,
): ContextMenuEntry[] {
  return [
    {
      kind: "item",
      label: "Add Card…",
      enabled: true,
      onSelect: actions.addCard,
    },
    {
      kind: "item",
      label: "Rename Column",
      enabled: true,
      onSelect: actions.rename,
    },
  ];
}

// Text fields keep WebKit's own menu: it carries copy/paste and spelling,
// which the app's menus do not replace.
export function isTextEditingTarget(target: EventTarget | null): boolean {
  return target instanceof Element &&
    target.closest("input, textarea, [contenteditable]") !== null;
}
