import type { Board } from "./board.ts";
import { fileNameOf, isSameCardPath } from "./boardPath.ts";
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
function listBoardCardHits(board: Board): CardSearchHit[] {
  const hits: CardSearchHit[] = [];
  for (const column of board.columns) {
    for (const card of column.cards) {
      hits.push({ card, columnId: column.id, columnName: column.name });
    }
  }
  return hits;
}

export function searchCardsByTitleOrFileName(
  board: Board,
  query: string,
): CardSearchHit[] {
  return filterCardHitsByTitleOrFileName(listBoardCardHits(board), query);
}

// Filtering preserves the caller's order, including MRU order for recent cards.
export function filterCardHitsByTitleOrFileName(
  hits: readonly CardSearchHit[],
  query: string,
): CardSearchHit[] {
  const normalizedQuery = canonicalSearchQuery(query);
  // An empty query gives the dialog its full list before anything is typed.
  if (normalizedQuery === "") return [...hits];
  return hits.filter(
    ({ card }) =>
      matchesTitle(card, normalizedQuery) ||
      canonicalSearchText(fileNameStem(card.path)).includes(normalizedQuery),
  );
}

function matchesTitle(card: Card, normalizedQuery: string): boolean {
  // The query's edge whitespace is already removed, so title padding cannot
  // affect the containment check.
  return canonicalSearchText(card.displayTitle).includes(normalizedQuery);
}

function fileNameStem(path: string): string {
  const fileName = fileNameOf(path);
  const extensionStart = fileName.lastIndexOf(".");
  return extensionStart > 0 ? fileName.slice(0, extensionStart) : fileName;
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
