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
