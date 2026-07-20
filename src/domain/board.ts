import type { Card } from "./card.ts";
import { normalizeCardPath } from "./boardPath.ts";

export interface Column {
  id: string;
  name: string;
  cards: Card[];
}

export interface Board {
  version: number;
  name: string;
  columns: Column[];
}

export interface CardLocation {
  columnId: string;
  index: number;
}

// The version this app writes into newly created board files. Loading keeps
// whatever version an existing file declares; only creation needs to know
// the current schema version.
export const BOARD_SCHEMA_VERSION = 1;

// Expects a validated (trimmed, non-empty) name; the blank check is an
// invariant guard, not user-facing validation.
export function createEmptyBoard(name: string): Board {
  if (name.trim() === "") {
    throw new Error("Board name must not be empty");
  }
  return { version: BOARD_SCHEMA_VERSION, name, columns: [] };
}

export class CardAlreadyExistsError extends Error {
  constructor(path: string) {
    super(`This Markdown is already on this board: ${path}`);
    this.name = "CardAlreadyExistsError";
  }
}

export function containsCardPath(board: Board, path: string): boolean {
  const normalizedPath = normalizeCardPath(path);
  return board.columns.some((column) =>
    column.cards.some((card) => normalizeCardPath(card.path) === normalizedPath)
  );
}

export function addCard(board: Board, columnId: string, card: Card): Board {
  if (containsCardPath(board, card.path)) {
    throw new CardAlreadyExistsError(card.path);
  }

  let found = false;
  const columns = board.columns.map((column) => {
    if (column.id !== columnId) return column;
    found = true;
    return { ...column, cards: [...column.cards, card] };
  });
  if (!found) {
    throw new Error(`Unknown column: ${columnId}`);
  }
  return { ...board, columns };
}

// Expects a validated column: the caller generates a fresh id and trims the
// name. The checks below are invariant guards, not user-facing validation.
// Id uniqueness is still asserted here because hand-written ids from existing
// board YAML and app-generated ids flow through the same function.
export function addColumn(board: Board, column: Column): Board {
  if (column.name.trim() === "") {
    throw new Error("Column name must not be empty");
  }
  if (board.columns.some((existing) => existing.id === column.id)) {
    throw new Error(`Duplicate column id: ${column.id}`);
  }
  return { ...board, columns: [...board.columns, column] };
}

// Expects a trimmed, non-empty name; the blank-name check is an invariant
// guard (the inline rename UI reverts blank input instead of submitting it).
// Renames only the board's name field - the board file itself keeps its
// path, so no reference (history, open windows) needs to follow.
export function renameBoard(board: Board, name: string): Board {
  if (name.trim() === "") {
    throw new Error("Board name must not be empty");
  }
  return { ...board, name };
}

// Expects a trimmed, non-empty name; the blank-name check is an invariant
// guard (the inline rename UI reverts blank input instead of submitting it).
export function renameColumn(
  board: Board,
  columnId: string,
  name: string,
): Board {
  if (name.trim() === "") {
    throw new Error("Column name must not be empty");
  }
  let found = false;
  const columns = board.columns.map((column) => {
    if (column.id !== columnId) return column;
    found = true;
    return { ...column, name };
  });
  if (!found) {
    throw new Error(`Unknown column: ${columnId}`);
  }
  return { ...board, columns };
}

// Refuses to remove a column that still holds cards: card references carry
// user data (priority, labels, order), and no code path may drop them
// silently. The UI keeps the delete action disabled for non-empty columns.
export function removeColumn(board: Board, columnId: string): Board {
  const column = board.columns.find((c) => c.id === columnId);
  if (!column) {
    throw new Error(`Unknown column: ${columnId}`);
  }
  if (column.cards.length > 0) {
    throw new Error(`Column is not empty: ${columnId}`);
  }
  return {
    ...board,
    columns: board.columns.filter((c) => c.id !== columnId),
  };
}

// `to.index` is always "the index as currently seen in the destination
// column" (append-to-end is expressed as Infinity, which Array.prototype
// .splice clamps to the array length). When from/to are the same column,
// removing the card first shifts every later index down by one, so we
// correct for that shift here - callers never need to special-case
// same-column vs cross-column moves.
export function moveCard(
  board: Board,
  from: CardLocation,
  to: CardLocation,
): Board {
  const columns = board.columns.map((column) => ({
    ...column,
    cards: [...column.cards],
  }));
  const fromColumn = mustFindColumn(columns, from.columnId);
  const toColumn = mustFindColumn(columns, to.columnId);

  const [card] = fromColumn.cards.splice(from.index, 1);

  const insertIndex = from.columnId === to.columnId && to.index > from.index
    ? to.index - 1
    : to.index;
  toColumn.cards.splice(insertIndex, 0, card);

  return { ...board, columns };
}

function mustFindColumn(columns: Column[], columnId: string): Column {
  const column = columns.find((c) => c.id === columnId);
  if (!column) {
    throw new Error(`Unknown column: ${columnId}`);
  }
  return column;
}
