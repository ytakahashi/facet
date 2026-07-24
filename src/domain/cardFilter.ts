import type { Card } from "./card.ts";
import type { Priority } from "./priority.ts";

export interface CardFilterCriteria {
  priority?: Priority;
}

export const EMPTY_CARD_FILTER: CardFilterCriteria = {};

export function isCardFilterActive(criteria: CardFilterCriteria): boolean {
  return criteria.priority !== undefined;
}

export function cardMatchesFilter(
  card: Card,
  criteria: CardFilterCriteria,
): boolean {
  return criteria.priority === undefined || card.priority === criteria.priority;
}

// CardDragData uses the card's position in Column.cards. Keeping that index
// here prevents filtered-out cards from shifting drag-and-drop destinations.
export function filterCardsPreservingIndex(
  cards: readonly Card[],
  criteria: CardFilterCriteria,
): { card: Card; index: number }[] {
  return cards
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => cardMatchesFilter(card, criteria));
}
