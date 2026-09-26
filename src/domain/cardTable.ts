import type { Board, Column } from "./board.ts";
import type { Card } from "./card.ts";
import type { CardFilterCriteria } from "./cardFilter.ts";
import { isCardHidden } from "./cardFilter.ts";
import { orderCardLabels } from "./label.ts";
import type { Priority } from "./priority.ts";

export type CardTableSortKey =
  | "title"
  | "labels"
  | "column"
  | "priority"
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

const priorityRank: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const PRIORITY_COUNT = Object.keys(priorityRank).length;

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
  return (key === "labels" && row.card.labels.length === 0) ||
    (key === "priority" && row.card.priority === undefined);
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
    case "priority":
      if (a.card.priority === undefined || b.card.priority === undefined) {
        return 0;
      }
      return comparePriorities(a.card.priority, b.card.priority);
    case "path":
      return collator.compare(a.card.path, b.card.path);
  }
}

// A hand-edited board can carry a priority outside the union, because loading
// only checks that it is a string. Such a value ranks after every known one,
// and unknown values compare by name, as unregistered labels do. Without this
// the rank lookup yields NaN, which sort() reads as "equal" and which breaks
// the comparator's consistency.
function comparePriorities(a: Priority, b: Priority): number {
  const leftRank = priorityRank[a] ?? PRIORITY_COUNT;
  const rightRank = priorityRank[b] ?? PRIORITY_COUNT;
  if (leftRank !== rightRank) return leftRank - rightRank;
  return leftRank === PRIORITY_COUNT ? collator.compare(a, b) : 0;
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
