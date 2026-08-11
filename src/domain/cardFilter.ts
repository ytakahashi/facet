import type { Board, Column } from "./board.ts";
import type { Card } from "./card.ts";
import type { Priority } from "./priority.ts";

// Every axis answers the same question - which cards the board shows right
// now - so hiding a column hides its cards rather than the column itself:
// the header stays interactive and the column stays a drop target.
//
// Label matching is AND (a card must carry every selected label), while
// priority stays a single optional value rather than a set: a card only
// ever has one priority, so letting a caller select several would make an
// AND across them always match zero cards.
//
// Columns are held as the hidden ids rather than the visible ones so that a
// newly added column shows up without anyone having to update the filter.
export interface CardFilterCriteria {
  labels: ReadonlySet<string>;
  priority?: Priority;
  hiddenColumnIds: ReadonlySet<string>;
}

export const EMPTY_CARD_FILTER: CardFilterCriteria = {
  labels: new Set(),
  hiddenColumnIds: new Set(),
};

// Takes the board so an id left behind by a deleted column does not count as
// an active filter: it hides nothing. Column ids are never reused (see
// boardStore.addColumn), so such an id can only linger, never resurface.
export function isCardFilterActive(
  board: Board,
  criteria: CardFilterCriteria,
): boolean {
  if (criteria.labels.size > 0 || criteria.priority !== undefined) return true;
  return board.columns.some((column) =>
    criteria.hiddenColumnIds.has(column.id)
  );
}

export function areColumnCardsHidden(
  column: Column,
  criteria: CardFilterCriteria,
): boolean {
  return criteria.hiddenColumnIds.has(column.id);
}

export function cardMatchesFilter(
  card: Card,
  criteria: CardFilterCriteria,
): boolean {
  if (criteria.priority !== undefined && card.priority !== criteria.priority) {
    return false;
  }
  for (const label of criteria.labels) {
    if (!card.labels.includes(label)) return false;
  }
  return true;
}

// Answers "is this one card on screen right now", which the column-wide
// question below cannot be asked for a single card: a card reached from
// outside the board layout (a search hit, say) knows its column only by id,
// and needs both axes - its column's visibility and its own fields - folded
// into one answer.
export function isCardHidden(
  card: Card,
  columnId: string,
  criteria: CardFilterCriteria,
): boolean {
  return criteria.hiddenColumnIds.has(columnId) ||
    !cardMatchesFilter(card, criteria);
}

// The single entry point for "what does this column show".
export function filterColumnCards(
  column: Column,
  criteria: CardFilterCriteria,
): { card: Card; index: number }[] {
  if (areColumnCardsHidden(column, criteria)) return [];
  return filterCardsPreservingIndex(column.cards, criteria);
}

// CardDragData uses the card's position in Column.cards. Keeping that index
// here prevents filtered-out cards from shifting drag-and-drop destinations.
function filterCardsPreservingIndex(
  cards: readonly Card[],
  criteria: CardFilterCriteria,
): { card: Card; index: number }[] {
  return cards
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => cardMatchesFilter(card, criteria));
}
