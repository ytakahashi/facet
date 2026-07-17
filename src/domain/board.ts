import type { Card } from "./card.ts";
import { normalizeCardPath } from "./boardPath.ts";

export interface Column {
  id: string;
  name: string;
  cards: Card[];
}

export interface Board {
  version: number;
  name: string;
  columns: Column[];
}

export interface CardLocation {
  columnId: string;
  index: number;
}

export class CardAlreadyExistsError extends Error {
  constructor(path: string) {
    super(`This Markdown is already on this board: ${path}`);
    this.name = "CardAlreadyExistsError";
  }
}

export function containsCardPath(board: Board, path: string): boolean {
  const normalizedPath = normalizeCardPath(path);
  return board.columns.some((column) =>
    column.cards.some((card) => normalizeCardPath(card.path) === normalizedPath)
  );
}

export function addCard(board: Board, columnId: string, card: Card): Board {
  if (containsCardPath(board, card.path)) {
    throw new CardAlreadyExistsError(card.path);
  }

  let found = false;
  const columns = board.columns.map((column) => {
    if (column.id !== columnId) return column;
    found = true;
    return { ...column, cards: [...column.cards, card] };
  });
  if (!found) {
    throw new Error(`Unknown column: ${columnId}`);
  }
  return { ...board, columns };
}

// `to.index` is always "the index as currently seen in the destination
// column" (append-to-end is expressed as Infinity, which Array.prototype
// .splice clamps to the array length). When from/to are the same column,
// removing the card first shifts every later index down by one, so we
// correct for that shift here - callers never need to special-case
// same-column vs cross-column moves.
export function moveCard(
  board: Board,
  from: CardLocation,
  to: CardLocation,
): Board {
  const columns = board.columns.map((column) => ({
    ...column,
    cards: [...column.cards],
  }));
  const fromColumn = mustFindColumn(columns, from.columnId);
  const toColumn = mustFindColumn(columns, to.columnId);

  const [card] = fromColumn.cards.splice(from.index, 1);

  const insertIndex = from.columnId === to.columnId && to.index > from.index
    ? to.index - 1
    : to.index;
  toColumn.cards.splice(insertIndex, 0, card);

  return { ...board, columns };
}

function mustFindColumn(columns: Column[], columnId: string): Column {
  const column = columns.find((c) => c.id === columnId);
  if (!column) {
    throw new Error(`Unknown column: ${columnId}`);
  }
  return column;
}
