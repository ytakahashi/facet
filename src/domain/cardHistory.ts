import { isSameCardPath } from "./boardPath.ts";

const entries: unique symbol = Symbol("entries");

// Only these operations know the storage order. Consumers ask for navigation
// destinations or a recent-card list rather than inspecting the representation.
export interface CardHistory {
  readonly [entries]: readonly string[];
}

// The recent-card list includes the current card. Ten entries leave room for
// the board's full card list below it in the search dialog.
export const CARD_HISTORY_LIMIT = 10;

export function emptyCardHistory(): CardHistory {
  return { [entries]: [] };
}

export function recordCardVisit(
  history: CardHistory,
  path: string,
): CardHistory {
  return {
    [entries]: [
      path,
      ...history[entries].filter((entry) => !isSameCardPath(entry, path)),
    ].slice(0, CARD_HISTORY_LIMIT),
  };
}

export function listRecentCards(
  history: CardHistory,
  isOnBoard: (path: string) => boolean,
): readonly string[] {
  return history[entries].filter(isOnBoard);
}

export function findPreviousCard(
  history: CardHistory,
  currentPath: string | undefined,
  isOnBoard: (path: string) => boolean,
): string | undefined {
  // Reloads can leave the current card anywhere in history, or off the board.
  // Exclude it by identity instead of assuming it is the first entry.
  return listRecentCards(history, isOnBoard).find(
    (path) => currentPath === undefined || !isSameCardPath(path, currentPath),
  );
}

export function retargetCardHistory(
  history: CardHistory,
  previousPath: string,
  nextPath: string,
): CardHistory {
  return {
    [entries]: uniquePaths(
      history[entries].map((path) =>
        isSameCardPath(path, previousPath) ? nextPath : path,
      ),
    ),
  };
}

export function removeFromCardHistory(
  history: CardHistory,
  path: string,
): CardHistory {
  return {
    [entries]: history[entries].filter((entry) => !isSameCardPath(entry, path)),
  };
}

function uniquePaths(paths: readonly string[]): readonly string[] {
  return paths.filter(
    (path, index) =>
      !paths.slice(0, index).some((other) => isSameCardPath(other, path)),
  );
}
