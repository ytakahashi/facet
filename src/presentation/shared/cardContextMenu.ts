import type { Board, CardColumnEdge } from "../../domain/board.ts";
import { findCardLocation } from "../../domain/board.ts";
import type { Card } from "../../domain/card.ts";
import type { ContextMenuEntry } from "../context/appContext.ts";

export interface CardContextMenuMoveActions {
  moveToColumn: (columnId: string) => void;
  moveToColumnEdge: (expectedColumnId: string, edge: CardColumnEdge) => void;
}

export interface CardContextMenuActions extends CardContextMenuMoveActions {
  duplicateCard: () => void;
  canDuplicateCard: boolean;
  copyText: (text: string) => void;
  reveal: (path: string) => void;
}

export function buildCardContextMenu(
  card: Card,
  board: Board,
  actions: CardContextMenuActions,
): ContextMenuEntry[] {
  const location = findCardLocation(board, card.path);
  const currentColumn = board.columns.find(
    ({ id }) => id === location?.columnId,
  );
  const moveEntries: ContextMenuEntry[] = [];
  if (location && currentColumn) {
    const destinations = board.columns.filter(
      ({ id }) => id !== currentColumn.id,
    );
    moveEntries.push(
      {
        kind: "item",
        label: "Top of this column",
        enabled: location.index > 0,
        onSelect: () => actions.moveToColumnEdge(currentColumn.id, "top"),
      },
      {
        kind: "item",
        label: "Bottom of this column",
        enabled: location.index < currentColumn.cards.length - 1,
        onSelect: () => actions.moveToColumnEdge(currentColumn.id, "bottom"),
      },
    );
    if (destinations.length > 0) moveEntries.push({ kind: "separator" });
    for (const column of destinations) {
      moveEntries.push({
        kind: "item",
        label: column.name,
        enabled: true,
        onSelect: () => actions.moveToColumn(column.id),
      });
    }
  }

  return [
    {
      kind: "item",
      label: "Copy Path",
      enabled: true,
      onSelect: () => actions.copyText(card.path),
    },
    {
      kind: "item",
      label: "Copy Absolute Path",
      enabled: card.absolutePath !== undefined,
      onSelect: () => {
        if (card.absolutePath !== undefined) {
          actions.copyText(card.absolutePath);
        }
      },
    },
    { kind: "separator" },
    {
      kind: "item",
      label: "Reveal in Finder",
      enabled: card.absolutePath !== undefined,
      onSelect: () => {
        if (card.absolutePath !== undefined) {
          actions.reveal(card.absolutePath);
        }
      },
    },
    { kind: "separator" },
    {
      kind: "item",
      label: "Duplicate Card",
      enabled: actions.canDuplicateCard,
      onSelect: actions.duplicateCard,
    },
    {
      kind: "submenu",
      label: "Move to",
      entries: moveEntries,
    },
  ];
}
