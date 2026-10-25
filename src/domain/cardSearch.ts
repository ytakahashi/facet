import type { Board } from "./board.ts";
import { isSameCardPath } from "./boardPath.ts";
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

// Resolves recently opened paths against the board as it is now: a history
// entry keeps the spelling and column a card had when it was opened, and both
// can have changed since. A path the board no longer holds is skipped; a card
// whose file is missing is still on the board, so it stays.
//
// Deduplication and the length limit belong to cardHistory.ts. The history is
// short enough that scanning the board once per path needs no index.
export function listRecentCardHits(
  board: Board,
  paths: readonly string[],
): CardSearchHit[] {
  const hits: CardSearchHit[] = [];
  for (const path of paths) {
    const hit = findCardHit(board, path);
    if (hit) hits.push(hit);
  }
  return hits;
}

function findCardHit(board: Board, path: string): CardSearchHit | undefined {
  for (const column of board.columns) {
    const card = column.cards.find((candidate) =>
      isSameCardPath(candidate.path, path),
    );
    if (card) return { card, columnId: column.id, columnName: column.name };
  }
  return undefined;
}
