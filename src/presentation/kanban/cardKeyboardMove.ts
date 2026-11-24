import {
  type Board,
  type CardLocation,
  findCardLocation,
} from "../../domain/board.ts";
import {
  type CardFilterCriteria,
  filterColumnCards,
} from "../../domain/cardFilter.ts";
import type { CardMoveDirection } from "../shared/shortcuts/cardMoveShortcut.ts";

export interface CardStep {
  from: CardLocation;
  to: CardLocation;
}

// Steps over the adjacent visible card, so cards hidden by the filter keep
// their stored order relative to each other. `to.index` is in moveCard's
// convention: the index before the moved card is removed. Returns undefined
// when the card is absent, hidden, or already first or last among visible
// cards.
export function resolveCardStep(
  board: Board,
  cardPath: string,
  direction: CardMoveDirection,
  criteria: CardFilterCriteria,
): CardStep | undefined {
  const from = findCardLocation(board, cardPath);
  if (!from) return undefined;
  const column = board.columns.find((c) => c.id === from.columnId);
  if (!column) return undefined;
  const visible = filterColumnCards(column, criteria);
  const position = visible.findIndex(({ index }) => index === from.index);
  if (position === -1) return undefined;

  if (direction === "up") {
    const previous = visible[position - 1];
    if (!previous) return undefined;
    return { from, to: { columnId: from.columnId, index: previous.index } };
  }
  const next = visible[position + 1];
  if (!next) return undefined;
  return { from, to: { columnId: from.columnId, index: next.index + 1 } };
}
