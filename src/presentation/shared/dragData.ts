// Shared data contract for the drag-and-drop wiring: Card (drag source and
// per-card drop target), the card list inside a Column, and Column itself
// (drag source and drop target for reordering) attach this data via
// getInitialData/getData, and resolveMove.ts / resolveColumnMove.ts read it
// back off the drop event to compute a move.
//
// Two kinds of drag share one monitor, so every drop target declares a canDrop
// keyed on `type`. That keeps the drop targets a card drag sees unchanged now
// that columns are targets too, which is what lets resolveMove keep reading
// the (innermost-first) target list by position.
// Label rows share the element adapter but have their own monitor. All
// resolvers and drop targets ignore other source types.

export interface CardDragData {
  [key: string]: unknown;
  [key: symbol]: unknown;
  type: "card";
  columnId: string;
  index: number;
}

export interface CardListDropData {
  [key: string]: unknown;
  [key: symbol]: unknown;
  type: "card-list";
  columnId: string;
}

export interface ColumnDragData {
  [key: string]: unknown;
  [key: symbol]: unknown;
  type: "column";
  columnId: string;
  index: number;
}

export interface LabelDragData {
  [key: string]: unknown;
  [key: symbol]: unknown;
  type: "label";
  name: string;
  index: number;
}
