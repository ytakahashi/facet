// Shared data contract for the drag-and-drop wiring: Card (drag source and
// per-card drop target) and Column (drop target for the card list) attach
// this data via getInitialData/getData, and resolveMove.ts reads it back
// off the drop event to compute a move.

export interface CardDragData {
  [key: string]: unknown;
  [key: symbol]: unknown;
  type: "card";
  columnId: string;
  index: number;
}

export interface ColumnDropData {
  [key: string]: unknown;
  [key: symbol]: unknown;
  type: "column";
  columnId: string;
}
