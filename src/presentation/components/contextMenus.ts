import type { ContextMenuEntry } from "../context/appContext.ts";
import type { Board } from "../../domain/board.ts";
import { findCardLocation } from "../../domain/board.ts";
import type { Card } from "../../domain/card.ts";

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

export interface BoardContextMenuActions {
  copyText: (text: string) => void;
  reveal: (path: string) => void;
}

export function buildBoardContextMenu(
  boardPath: string,
  actions: BoardContextMenuActions,
): ContextMenuEntry[] {
  return [
    {
      kind: "item",
      label: "Copy Board File Path",
      enabled: true,
      onSelect: () => actions.copyText(boardPath),
    },
    {
      kind: "item",
      label: "Reveal in Finder",
      enabled: true,
      onSelect: () => actions.reveal(boardPath),
    },
  ];
}

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
