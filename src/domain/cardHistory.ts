import { isSameCardPath } from "./boardPath.ts";

const entries: unique symbol = Symbol("entries");

// The representation stays private because adding forward navigation would
// change how visits are stored. Consumers should only ask the operations below
// rather than depend on the current entry being the last element of an array.
export interface CardHistory {
  readonly [entries]: readonly string[];
}

// Fifty visits is enough to retrace a useful navigation session while keeping
// every operation over this in-memory path list predictably small.
export const CARD_HISTORY_LIMIT = 50;

export function emptyCardHistory(): CardHistory {
  return { [entries]: [] };
}

export function recordCardVisit(
  history: CardHistory,
  path: string,
): CardHistory {
  const current = history[entries];
  if (
    current.length > 0 && isSameCardPath(current[current.length - 1], path)
  ) {
    return history;
  }

  return {
    [entries]: [...current, path].slice(-CARD_HISTORY_LIMIT),
  };
}

export function findPreviousCard(
  history: CardHistory,
  isOnBoard: (path: string) => boolean,
): { path: string; history: CardHistory } | undefined {
  // The final entry describes the card currently shown, even when a board
  // reload has since removed it. It is never itself a back destination.
  const candidates = history[entries].slice(0, -1);
  const retained = candidates.filter(isOnBoard);
  if (retained.length === 0) return undefined;

  const normalized = collapseAdjacent(retained);
  return {
    path: normalized.at(-1)!,
    history: { [entries]: normalized },
  };
}

export function retargetCardHistory(
  history: CardHistory,
  previousPath: string,
  nextPath: string,
): CardHistory {
  return {
    [entries]: collapseAdjacent(
      history[entries].map((path) =>
        isSameCardPath(path, previousPath) ? nextPath : path
      ),
    ),
  };
}

export function removeFromCardHistory(
  history: CardHistory,
  path: string,
): CardHistory {
  return {
    [entries]: collapseAdjacent(
      history[entries].filter((entry) => !isSameCardPath(entry, path)),
    ),
  };
}

function collapseAdjacent(paths: readonly string[]): readonly string[] {
  return paths.filter((path, index) =>
    index === 0 || !isSameCardPath(paths[index - 1], path)
  );
}
