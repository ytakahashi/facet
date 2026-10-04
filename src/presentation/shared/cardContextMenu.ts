import type { Board } from "../../domain/board.ts";
import { findCardLocation } from "../../domain/board.ts";
import type { Card } from "../../domain/card.ts";
import type { ContextMenuEntry } from "../context/appContext.ts";

export interface CardContextMenuActions {
  copyText: (text: string) => void;
  reveal: (path: string) => void;
  moveToColumn: (columnId: string) => void;
}

export function buildCardContextMenu(
  card: Card,
  board: Board,
  actions: CardContextMenuActions,
): ContextMenuEntry[] {
  const currentColumnId = findCardLocation(board, card.path)?.columnId;
  const destinations = currentColumnId === undefined
    ? []
    : board.columns.filter(
      (column) => column.id !== currentColumnId,
    );

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
      kind: "submenu",
      label: "Move to",
      entries: destinations.map((column) => ({
        kind: "item",
        label: column.name,
        enabled: true,
        onSelect: () => actions.moveToColumn(column.id),
      })),
    },
  ];
}
