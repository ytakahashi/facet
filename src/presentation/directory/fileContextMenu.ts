import type { Board } from "../../domain/board.ts";
import type { ContextMenuEntry } from "../context/appContext.ts";

export function buildFileContextMenu(
  board: Board,
  adding: boolean,
  addToColumn: (columnId: string) => void,
): ContextMenuEntry[] {
  return [
    {
      kind: "submenu",
      label: "Add to Board",
      entries:
        board.columns.length === 0
          ? [
              {
                kind: "item",
                label: "No columns",
                enabled: false,
                onSelect: () => {},
              },
            ]
          : board.columns.map((column) => ({
              kind: "item",
              label: column.name,
              enabled: !adding,
              onSelect: () => addToColumn(column.id),
            })),
    },
  ];
}
