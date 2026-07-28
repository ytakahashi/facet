import type { Card } from "./card.ts";
import type { LabelColor, LabelDefinition } from "./label.ts";
import type { Priority } from "./priority.ts";
import { normalizeCardPath } from "./boardPath.ts";

export interface Column {
  id: string;
  name: string;
  cards: Card[];
}

export interface Board {
  version: number;
  name: string;
  labels: LabelDefinition[];
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
  return { version: BOARD_SCHEMA_VERSION, name, labels: [], columns: [] };
}

export class CardAlreadyExistsError extends Error {
  constructor(path: string) {
    super(`This Markdown is already on this board: ${path}`);
    this.name = "CardAlreadyExistsError";
  }
}

export class LabelAlreadyExistsError extends Error {
  constructor(name: string) {
    super(`A label with this name already exists: ${name}`);
    this.name = "LabelAlreadyExistsError";
  }
}

export function containsCardPath(board: Board, path: string): boolean {
  const normalizedPath = normalizeCardPath(path);
  return board.columns.some((column) =>
    column.cards.some((card) => normalizeCardPath(card.path) === normalizedPath)
  );
}

// A card's path is unique across the whole board (containsCardPath is what
// enforces that on add), so it can be located without a columnId.
export function findCardByPath(board: Board, path: string): Card | undefined {
  const normalizedPath = normalizeCardPath(path);
  for (const column of board.columns) {
    const card = column.cards.find((c) =>
      normalizeCardPath(c.path) === normalizedPath
    );
    if (card) return card;
  }
  return undefined;
}

export function findLabelDefinition(
  board: Board,
  name: string,
): LabelDefinition | undefined {
  return board.labels.find((label) => label.name === name);
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

// Expects a trimmed, non-empty title; the blank-title check is an invariant
// guard (the inline rename UI reverts blank input instead of submitting it).
// A title override always wins the display priority order (see
// resolveCardTitle in card.ts), so titleOverride and displayTitle are set to
// the same value here - the caller does not need to re-run title resolution.
export function setCardTitle(
  board: Board,
  cardPath: string,
  title: string,
): Board {
  if (title.trim() === "") {
    throw new Error("Card title must not be empty");
  }
  const normalizedPath = normalizeCardPath(cardPath);
  let found = false;
  const columns = board.columns.map((column) => {
    const index = column.cards.findIndex((c) =>
      normalizeCardPath(c.path) === normalizedPath
    );
    if (index === -1) return column;
    found = true;
    const cards = [...column.cards];
    cards[index] = {
      ...cards[index],
      titleOverride: title,
      displayTitle: title,
    };
    return { ...column, cards };
  });
  if (!found) {
    throw new Error(`Unknown card: ${cardPath}`);
  }
  return { ...board, columns };
}

// `priority` of `undefined` clears the card's priority. `Priority` is a
// closed union, so unlike title/name fields there is no blank-value case to
// guard against here - the caller can only ever pass a valid value or
// undefined.
export function setCardPriority(
  board: Board,
  cardPath: string,
  priority: Priority | undefined,
): Board {
  const normalizedPath = normalizeCardPath(cardPath);
  let found = false;
  const columns = board.columns.map((column) => {
    const index = column.cards.findIndex((c) =>
      normalizeCardPath(c.path) === normalizedPath
    );
    if (index === -1) return column;
    found = true;
    const cards = [...column.cards];
    cards[index] = { ...cards[index], priority };
    return { ...column, cards };
  });
  if (!found) {
    throw new Error(`Unknown card: ${cardPath}`);
  }
  return { ...board, columns };
}

// A card may only reference labels present in the board's registry - the
// registry is the single source of truth for which names (and colors) exist.
// The caller (store) checks card.labels.includes(labelName) before calling,
// so a duplicate here is an invariant violation, not a normal toggle-off.
export function addLabelToCard(
  board: Board,
  cardPath: string,
  labelName: string,
): Board {
  if (!findLabelDefinition(board, labelName)) {
    throw new Error(`Unknown label: ${labelName}`);
  }
  const normalizedPath = normalizeCardPath(cardPath);
  let found = false;
  const columns = board.columns.map((column) => {
    const index = column.cards.findIndex((c) =>
      normalizeCardPath(c.path) === normalizedPath
    );
    if (index === -1) return column;
    found = true;
    const card = column.cards[index];
    if (card.labels.includes(labelName)) {
      throw new Error(`Label already on card: ${labelName}`);
    }
    const cards = [...column.cards];
    cards[index] = { ...card, labels: [...card.labels, labelName] };
    return { ...column, cards };
  });
  if (!found) {
    throw new Error(`Unknown card: ${cardPath}`);
  }
  return { ...board, columns };
}

// The store checks card.labels.includes(labelName) before calling, so
// removing an absent label here is an invariant violation, not a normal
// toggle-off.
export function removeLabelFromCard(
  board: Board,
  cardPath: string,
  labelName: string,
): Board {
  const normalizedPath = normalizeCardPath(cardPath);
  let found = false;
  const columns = board.columns.map((column) => {
    const index = column.cards.findIndex((c) =>
      normalizeCardPath(c.path) === normalizedPath
    );
    if (index === -1) return column;
    found = true;
    const card = column.cards[index];
    if (!card.labels.includes(labelName)) {
      throw new Error(`Label not on card: ${labelName}`);
    }
    const cards = [...column.cards];
    cards[index] = {
      ...card,
      labels: card.labels.filter((label) => label !== labelName),
    };
    return { ...column, cards };
  });
  if (!found) {
    throw new Error(`Unknown card: ${cardPath}`);
  }
  return { ...board, columns };
}

// Drops only the board's reference to the card. Whether the Markdown file
// itself is deleted is decided one layer up, where the file I/O lives, so this
// stays a pure board transformation like the other card operations.
// Labels the card used are left in the registry: the registry is the board's
// vocabulary, independent of how many cards currently use a name.
export function removeCard(board: Board, cardPath: string): Board {
  const normalizedPath = normalizeCardPath(cardPath);
  let found = false;
  const columns = board.columns.map((column) => {
    const index = column.cards.findIndex((c) =>
      normalizeCardPath(c.path) === normalizedPath
    );
    if (index === -1) return column;
    found = true;
    return {
      ...column,
      cards: column.cards.filter((_, i) => i !== index),
    };
  });
  if (!found) {
    throw new Error(`Unknown card: ${cardPath}`);
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

// Expects a validated label: the caller trims the name. Duplicate names are
// rejected because the name is the label's identity (see label.ts) - unlike
// Column, there is no separate id to keep addressing stable across a rename.
export function addLabelDefinition(
  board: Board,
  label: LabelDefinition,
): Board {
  if (label.name.trim() === "") {
    throw new Error("Label name must not be empty");
  }
  if (findLabelDefinition(board, label.name)) {
    throw new LabelAlreadyExistsError(label.name);
  }
  return { ...board, labels: [...board.labels, label] };
}

// Renaming a label's name is the one card-cascading registry operation:
// since a card's labels are plain name strings (no id indirection), leaving
// the old name on cards after a rename would orphan it from the registry
// entry that carries its color. Any duplicate produced by the replacement
// (e.g. a hand-edited board.yaml that already listed both the old and new
// name on the same card) is deduped, since a card's labels are a set, not an
// ordered log.
export function renameLabelDefinition(
  board: Board,
  name: string,
  nextName: string,
): Board {
  if (!findLabelDefinition(board, name)) {
    throw new Error(`Unknown label: ${name}`);
  }
  if (nextName !== name && findLabelDefinition(board, nextName)) {
    throw new LabelAlreadyExistsError(nextName);
  }
  const labels = board.labels.map((label) =>
    label.name === name ? { ...label, name: nextName } : label
  );
  const columns = board.columns.map((column) => ({
    ...column,
    cards: column.cards.map((card) =>
      card.labels.includes(name)
        ? {
          ...card,
          labels: [
            ...new Set(
              card.labels.map((label) => label === name ? nextName : label),
            ),
          ],
        }
        : card
    ),
  }));
  return { ...board, labels, columns };
}

// Expects a validated color; `LabelColor` is a closed union, so there is no
// blank-value case to guard against here.
export function setLabelColor(
  board: Board,
  name: string,
  color: LabelColor,
): Board {
  if (!findLabelDefinition(board, name)) {
    throw new Error(`Unknown label: ${name}`);
  }
  const labels = board.labels.map((label) =>
    label.name === name ? { ...label, color } : label
  );
  return { ...board, labels };
}

// Cascades to every card holding this label, unlike removeColumn (which
// refuses to remove a non-empty Column). A label reference is a single
// string tag, not a Card's whole set of fields, so silently dropping it from
// every card carries far less risk of unintended data loss than removing a
// Column full of Cards would.
export function removeLabelDefinition(board: Board, name: string): Board {
  if (!findLabelDefinition(board, name)) {
    throw new Error(`Unknown label: ${name}`);
  }
  const labels = board.labels.filter((label) => label.name !== name);
  const columns = board.columns.map((column) => ({
    ...column,
    cards: column.cards.map((card) =>
      card.labels.includes(name)
        ? { ...card, labels: card.labels.filter((label) => label !== name) }
        : card
    ),
  }));
  return { ...board, labels, columns };
}

// `toIndex` follows the same convention as moveCard's `to.index`: the position
// as currently rendered, before the column is lifted out of the row. Removing
// it first shifts every later position down by one, so that shift is corrected
// here and callers can always pass the position they see. Out-of-range values
// are clamped by Array.prototype.splice, which is how "past the last column"
// arrives from a drop on the right edge of the rightmost column.
// Unlike a card, a column carries a board-unique id, so the source is
// identified by id rather than by position.
export function moveColumn(
  board: Board,
  columnId: string,
  toIndex: number,
): Board {
  const fromIndex = board.columns.findIndex((column) => column.id === columnId);
  if (fromIndex === -1) {
    throw new Error(`Unknown column: ${columnId}`);
  }

  const columns = [...board.columns];
  const [column] = columns.splice(fromIndex, 1);
  columns.splice(fromIndex < toIndex ? toIndex - 1 : toIndex, 0, column);

  return { ...board, columns };
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
