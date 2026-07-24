import type { Card } from "./card.ts";
import type { Priority } from "./priority.ts";

// Label matching is AND (a card must carry every selected label), while
// priority stays a single optional value rather than a set: a card only
// ever has one priority, so letting a caller select several would make an
// AND across them always match zero cards.
export interface CardFilterCriteria {
  labels: ReadonlySet<string>;
  priority?: Priority;
}

export const EMPTY_CARD_FILTER: CardFilterCriteria = { labels: new Set() };

export function isCardFilterActive(criteria: CardFilterCriteria): boolean {
  return criteria.labels.size > 0 || criteria.priority !== undefined;
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
