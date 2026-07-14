import { describe, expect, it } from "vitest";
import type { Board, Column } from "./board.ts";
import { moveCard } from "./board.ts";
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
