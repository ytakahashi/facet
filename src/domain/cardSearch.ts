import type { Board } from "./board.ts";
import type { Card } from "./card.ts";
import { canonicalSearchQuery, canonicalSearchText } from "./searchText.ts";

// Carries the column a card sits in, because two cards can share a title:
// the column is what tells two otherwise identical results apart.
export interface CardSearchHit {
  card: Card;
  columnId: string;
  columnName: string;
}

// Searches what the board holds rather than what it currently shows: the
// card being looked for is often the one a filter has just hidden, so
// dropping those from the results would defeat the search. Whether a hit is
// on screen is a separate question, answered by isCardHidden.
//
// Board order (columns, then cards within a column) is the result order. It
// is the order already on screen, and the same query always produces the
// same list.
//
// An empty query matches every card rather than none, so opening the search
// gives something to scroll through before anything is typed.
export function searchCardsByTitle(
  board: Board,
  query: string,
): CardSearchHit[] {
  const normalizedQuery = canonicalSearchQuery(query);
  const hits: CardSearchHit[] = [];
  for (const column of board.columns) {
    for (const card of column.cards) {
      if (
        normalizedQuery === "" ||
        // Keeping whitespace at the title's edges does not affect containment:
        // the query's own edge whitespace has already been removed above.
        canonicalSearchText(card.displayTitle).includes(normalizedQuery)
      ) {
        hits.push({ card, columnId: column.id, columnName: column.name });
      }
    }
  }
  return hits;
}
