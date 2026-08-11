import type { Board } from "./board.ts";
import type { Card } from "./card.ts";

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
  const normalizedQuery = canonicalTitle(query);
  const hits: CardSearchHit[] = [];
  for (const column of board.columns) {
    for (const card of column.cards) {
      if (
        normalizedQuery === "" ||
        canonicalTitle(card.displayTitle).includes(normalizedQuery)
      ) {
        hits.push({ card, columnId: column.id, columnName: column.name });
      }
    }
  }
  return hits;
}

// Folds the two differences a reader would not call differences.
// Letter case, and Unicode composition: a title falling back to a file name
// arrives decomposed from the file system, while the same characters typed
// into the search box arrive composed.
// toLowerCase, not toLocaleLowerCase: the mapping must not depend on the
// user's locale (a Turkish locale maps I to a dotless ı, which would make
// two unrelated titles match).
// Only the ends are trimmed - spacing inside a query is part of what is
// being searched for.
function canonicalTitle(value: string): string {
  return value.trim().normalize("NFC").toLowerCase();
}
