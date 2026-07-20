import { describe, expect, it } from "vitest";
import type { Board, Column } from "./board.ts";
import {
  addCard,
  addColumn,
  CardAlreadyExistsError,
  containsCardPath,
  createEmptyBoard,
  findCardByPath,
  moveCard,
  removeColumn,
  renameBoard,
  renameColumn,
  setCardPriority,
  setCardTitle,
} from "./board.ts";
import type { Card } from "./card.ts";

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    path: "card.md",
    labels: [],
    displayTitle: "Card",
    ...overrides,
  };
}

function makeColumn(overrides: Partial<Column> = {}): Column {
  return {
    id: "column",
    name: "Column",
    cards: [],
    ...overrides,
  };
}

function makeBoard(overrides: Partial<Board> = {}): Board {
  return {
    version: 1,
    name: "Board",
    columns: [],
    ...overrides,
  };
}

describe("moveCard", () => {
  it("moves a card later in the same column, inserting before the card originally at the target index", () => {
    const a = makeCard({ path: "a.md" });
    const b = makeCard({ path: "b.md" });
    const c = makeCard({ path: "c.md" });
    const board = makeBoard({
      columns: [makeColumn({ id: "doing", cards: [a, b, c] })],
    });

    const result = moveCard(
      board,
      { columnId: "doing", index: 0 },
      { columnId: "doing", index: 2 },
    );

    expect(result.columns[0].cards).toEqual([b, a, c]);
  });

  it("moves a card forward within the same column", () => {
    const a = makeCard({ path: "a.md" });
    const b = makeCard({ path: "b.md" });
    const c = makeCard({ path: "c.md" });
    const board = makeBoard({
      columns: [makeColumn({ id: "doing", cards: [a, b, c] })],
    });

    const result = moveCard(
      board,
      { columnId: "doing", index: 2 },
      { columnId: "doing", index: 0 },
    );

    expect(result.columns[0].cards).toEqual([c, a, b]);
  });

  it("leaves the order unchanged when dropped back at its own position", () => {
    const a = makeCard({ path: "a.md" });
    const b = makeCard({ path: "b.md" });
    const board = makeBoard({
      columns: [makeColumn({ id: "doing", cards: [a, b] })],
    });

    const result = moveCard(
      board,
      { columnId: "doing", index: 0 },
      { columnId: "doing", index: 0 },
    );

    expect(result.columns[0].cards).toEqual([a, b]);
  });

  it("moves a card into the middle of a different column", () => {
    const moved = makeCard({ path: "moved.md" });
    const x = makeCard({ path: "x.md" });
    const y = makeCard({ path: "y.md" });
    const board = makeBoard({
      columns: [
        makeColumn({ id: "doing", cards: [moved] }),
        makeColumn({ id: "done", cards: [x, y] }),
      ],
    });

    const result = moveCard(
      board,
      { columnId: "doing", index: 0 },
      { columnId: "done", index: 1 },
    );

    expect(result.columns[0].cards).toEqual([]);
    expect(result.columns[1].cards).toEqual([x, moved, y]);
  });

  it("appends a card to the end of a different column using Infinity", () => {
    const moved = makeCard({ path: "moved.md" });
    const x = makeCard({ path: "x.md" });
    const board = makeBoard({
      columns: [
        makeColumn({ id: "doing", cards: [moved] }),
        makeColumn({ id: "done", cards: [x] }),
      ],
    });

    const result = moveCard(
      board,
      { columnId: "doing", index: 0 },
      { columnId: "done", index: Number.POSITIVE_INFINITY },
    );

    expect(result.columns[1].cards).toEqual([x, moved]);
  });

  it("moves a card into an empty column", () => {
    const moved = makeCard({ path: "moved.md" });
    const board = makeBoard({
      columns: [
        makeColumn({ id: "doing", cards: [moved] }),
        makeColumn({ id: "done", cards: [] }),
      ],
    });

    const result = moveCard(
      board,
      { columnId: "doing", index: 0 },
      { columnId: "done", index: Number.POSITIVE_INFINITY },
    );

    expect(result.columns[1].cards).toEqual([moved]);
  });
});

describe("addCard", () => {
  it("appends a card to the target column without changing other columns", () => {
    const existing = makeCard({ path: "existing.md" });
    const added = makeCard({ path: "added.md" });
    const untouched = makeColumn({ id: "done", cards: [existing] });
    const board = makeBoard({
      columns: [makeColumn({ id: "doing" }), untouched],
    });

    const result = addCard(board, "doing", added);

    expect(result.columns[0].cards).toEqual([added]);
    expect(result.columns[1]).toBe(untouched);
    expect(board.columns[0].cards).toEqual([]);
  });

  it("rejects an unknown target column", () => {
    const board = makeBoard({ columns: [makeColumn({ id: "doing" })] });

    const act = () => addCard(board, "missing", makeCard());

    expect(act).toThrow("Unknown column: missing");
  });

  it("rejects a path already present on the board after normalization", () => {
    const board = makeBoard({
      columns: [makeColumn({ cards: [makeCard({ path: "notes/card.md" })] })],
    });

    const act = () =>
      addCard(
        board,
        "column",
        makeCard({ path: "./notes/other/../card.md" }),
      );

    expect(act).toThrow(CardAlreadyExistsError);
  });
});

describe("findCardByPath", () => {
  it("finds a card by path across columns", () => {
    const target = makeCard({ path: "target.md" });
    const board = makeBoard({
      columns: [
        makeColumn({ id: "doing", cards: [makeCard({ path: "other.md" })] }),
        makeColumn({ id: "done", cards: [target] }),
      ],
    });

    const result = findCardByPath(board, "target.md");

    expect(result).toBe(target);
  });

  it("returns undefined when no card matches the path", () => {
    const board = makeBoard({
      columns: [makeColumn({ cards: [makeCard({ path: "a.md" })] })],
    });

    const result = findCardByPath(board, "missing.md");

    expect(result).toBeUndefined();
  });
});

describe("setCardTitle", () => {
  it("sets titleOverride and displayTitle to the given title, keeping other cards untouched", () => {
    const target = makeCard({ path: "target.md", displayTitle: "Original" });
    const untouched = makeCard({ path: "other.md" });
    const board = makeBoard({
      columns: [makeColumn({ id: "doing", cards: [target, untouched] })],
    });

    const result = setCardTitle(board, "target.md", "New Title");

    expect(result.columns[0].cards[0]).toEqual({
      ...target,
      titleOverride: "New Title",
      displayTitle: "New Title",
    });
    expect(result.columns[0].cards[1]).toBe(untouched);
    expect(board.columns[0].cards[0]).toBe(target);
  });

  it("rejects a blank title", () => {
    const board = makeBoard({
      columns: [makeColumn({ cards: [makeCard({ path: "target.md" })] })],
    });

    const act = () => setCardTitle(board, "target.md", "  ");

    expect(act).toThrow("Card title must not be empty");
  });

  it("rejects an unknown card path", () => {
    const board = makeBoard({
      columns: [makeColumn({ cards: [makeCard({ path: "target.md" })] })],
    });

    const act = () => setCardTitle(board, "missing.md", "New Title");

    expect(act).toThrow("Unknown card: missing.md");
  });
});

describe("setCardPriority", () => {
  it("sets the priority, keeping other cards untouched", () => {
    const target = makeCard({ path: "target.md" });
    const untouched = makeCard({ path: "other.md" });
    const board = makeBoard({
      columns: [makeColumn({ id: "doing", cards: [target, untouched] })],
    });

    const result = setCardPriority(board, "target.md", "high");

    expect(result.columns[0].cards[0]).toEqual({ ...target, priority: "high" });
    expect(result.columns[0].cards[1]).toBe(untouched);
    expect(board.columns[0].cards[0]).toBe(target);
  });

  it("clears the priority when given undefined", () => {
    const target = makeCard({ path: "target.md", priority: "medium" });
    const board = makeBoard({
      columns: [makeColumn({ cards: [target] })],
    });

    const result = setCardPriority(board, "target.md", undefined);

    expect(result.columns[0].cards[0].priority).toBeUndefined();
  });

  it("rejects an unknown card path", () => {
    const board = makeBoard({
      columns: [makeColumn({ cards: [makeCard({ path: "target.md" })] })],
    });

    const act = () => setCardPriority(board, "missing.md", "low");

    expect(act).toThrow("Unknown card: missing.md");
  });
});

describe("addColumn", () => {
  it("appends the column to the right end without changing existing columns", () => {
    const existing = makeColumn({ id: "doing", cards: [makeCard()] });
    const board = makeBoard({ columns: [existing] });
    const added = makeColumn({ id: "added", name: "Added" });

    const result = addColumn(board, added);

    expect(result.columns).toEqual([existing, added]);
    expect(result.columns[0]).toBe(existing);
    expect(board.columns).toEqual([existing]);
  });

  it("rejects a duplicate column id", () => {
    const board = makeBoard({ columns: [makeColumn({ id: "doing" })] });

    const act = () =>
      addColumn(board, makeColumn({ id: "doing", name: "Doing again" }));

    expect(act).toThrow("Duplicate column id: doing");
  });

  it("rejects a blank column name", () => {
    const board = makeBoard();

    const act = () => addColumn(board, makeColumn({ id: "blank", name: "  " }));

    expect(act).toThrow("Column name must not be empty");
  });
});

describe("renameColumn", () => {
  it("changes only the name, keeping the id and the cards reference", () => {
    const cards = [makeCard()];
    const untouched = makeColumn({ id: "done" });
    const board = makeBoard({
      columns: [makeColumn({ id: "doing", name: "Doing", cards }), untouched],
    });

    const result = renameColumn(board, "doing", "In Progress");

    expect(result.columns[0].id).toBe("doing");
    expect(result.columns[0].name).toBe("In Progress");
    expect(result.columns[0].cards).toBe(cards);
    expect(result.columns[1]).toBe(untouched);
    expect(board.columns[0].name).toBe("Doing");
  });

  it("rejects a blank name", () => {
    const board = makeBoard({ columns: [makeColumn({ id: "doing" })] });

    const act = () => renameColumn(board, "doing", "  ");

    expect(act).toThrow("Column name must not be empty");
  });

  it("rejects an unknown column", () => {
    const board = makeBoard({ columns: [makeColumn({ id: "doing" })] });

    const act = () => renameColumn(board, "missing", "New name");

    expect(act).toThrow("Unknown column: missing");
  });
});

describe("removeColumn", () => {
  it("removes an empty column without changing other columns", () => {
    const untouched = makeColumn({ id: "doing", cards: [makeCard()] });
    const board = makeBoard({
      columns: [untouched, makeColumn({ id: "done" })],
    });

    const result = removeColumn(board, "done");

    expect(result.columns).toEqual([untouched]);
    expect(result.columns[0]).toBe(untouched);
    expect(board.columns).toHaveLength(2);
  });

  it("rejects a column that still holds cards", () => {
    const board = makeBoard({
      columns: [makeColumn({ id: "doing", cards: [makeCard()] })],
    });

    const act = () => removeColumn(board, "doing");

    expect(act).toThrow("Column is not empty: doing");
  });

  it("rejects an unknown column", () => {
    const board = makeBoard({ columns: [makeColumn({ id: "doing" })] });

    const act = () => removeColumn(board, "missing");

    expect(act).toThrow("Unknown column: missing");
  });
});

describe("containsCardPath", () => {
  it("finds an equivalent path in any column", () => {
    const board = makeBoard({
      columns: [makeColumn({ cards: [makeCard({ path: "./notes/card.md" })] })],
    });

    const result = containsCardPath(board, "notes/card.md");

    expect(result).toBe(true);
  });
});

describe("renameBoard", () => {
  it("renames the board and keeps the columns reference", () => {
    const columns = [makeColumn({ cards: [makeCard()] })];
    const board = makeBoard({ name: "Before", columns });

    const result = renameBoard(board, "After");

    expect(result.name).toBe("After");
    expect(result.columns).toBe(columns);
    expect(board.name).toBe("Before");
  });

  it("rejects a blank name", () => {
    const board = makeBoard();

    const act = () => renameBoard(board, "   ");

    expect(act).toThrow("Board name must not be empty");
  });
});

describe("createEmptyBoard", () => {
  it("creates a board with the current schema version and no columns", () => {
    const result = createEmptyBoard("My Board");

    expect(result).toEqual({ version: 1, name: "My Board", columns: [] });
  });

  it("rejects a blank name", () => {
    const act = () => createEmptyBoard("   ");

    expect(act).toThrow("Board name must not be empty");
  });
});
