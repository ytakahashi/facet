import type { Card } from "./card.ts";

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
