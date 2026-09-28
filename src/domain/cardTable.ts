import type { Board, Column } from "./board.ts";
import type { Card } from "./card.ts";
import type { CardFilterCriteria } from "./cardFilter.ts";
import { isCardHidden } from "./cardFilter.ts";
import { orderCardLabels } from "./label.ts";

export type CardTableSortKey =
  | "title"
  | "labels"
  | "column"
  | "path";

export type SortDirection = "asc" | "desc";

export interface CardTableSort {
  key: CardTableSortKey;
  direction: SortDirection;
}

export interface CardTableRow {
  card: Card;
  column: Column;
  columnIndex: number;
  cardIndex: number;
}

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "accent",
});

export function listCardTableRows(
  board: Board,
  criteria: CardFilterCriteria,
  sort: CardTableSort | undefined,
): CardTableRow[] {
  const rows = board.columns.flatMap((column, columnIndex) =>
    column.cards.flatMap((card, cardIndex) =>
      isCardHidden(card, column.id, criteria)
        ? []
        : [{ card, column, columnIndex, cardIndex }]
    )
  );
  if (!sort) return rows;

  const positions = new Map(
    board.labels.map((label, index) => [label.name, index]),
  );
  return rows.sort((a, b) => {
    const aIsEmpty = isEmpty(a, sort.key);
    const bIsEmpty = isEmpty(b, sort.key);
    // Empty values are always last, even when descending. Reverse only
    // comparisons between present values.
    if (aIsEmpty !== bIsEmpty) return aIsEmpty ? 1 : -1;
    const valueComparison = aIsEmpty
      ? 0
      : compareRows(a, b, sort.key, positions);
    if (valueComparison !== 0) {
      return sort.direction === "asc" ? valueComparison : -valueComparison;
    }
    // Board order is the tie-breaker in both directions.
    return a.columnIndex - b.columnIndex || a.cardIndex - b.cardIndex;
  });
}

function isEmpty(row: CardTableRow, key: CardTableSortKey): boolean {
  return key === "labels" && row.card.labels.length === 0;
}

function compareRows(
  a: CardTableRow,
  b: CardTableRow,
  key: CardTableSortKey,
  positions: ReadonlyMap<string, number>,
): number {
  switch (key) {
    case "title":
      return collator.compare(a.card.displayTitle, b.card.displayTitle);
    case "labels":
      return compareLabels(a.card.labels, b.card.labels, positions);
    case "column":
      return a.columnIndex - b.columnIndex;
    case "path":
      return collator.compare(a.card.path, b.card.path);
  }
}

function compareLabels(
  a: readonly string[],
  b: readonly string[],
  positions: ReadonlyMap<string, number>,
): number {
  const left = orderCardLabels(a, positions);
  const right = orderCardLabels(b, positions);
  for (let index = 0; index < Math.min(left.length, right.length); index++) {
    const leftRank = positions.get(left[index]) ?? positions.size;
    const rightRank = positions.get(right[index]) ?? positions.size;
    if (leftRank !== rightRank) return leftRank - rightRank;
    if (leftRank === positions.size) {
      const comparison = collator.compare(left[index], right[index]);
      if (comparison !== 0) return comparison;
    }
  }
  return left.length - right.length;
}
