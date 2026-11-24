import type { Board, CardLocation } from "../../domain/board.ts";

// The position counts every card in the column, hidden ones included, so it
// matches the stored order rather than what the filter currently shows.
export function describeCardPosition(
  board: Board,
  location: CardLocation,
): string | undefined {
  const column = board.columns.find((c) => c.id === location.columnId);
  const card = column?.cards[location.index];
  if (!column || !card) return undefined;
  return `Moved ${card.displayTitle} to ${column.name}, position ${location.index + 1} of ${column.cards.length}.`;
}
