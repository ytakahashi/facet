import { describe, expect, it } from "vitest";
import type { Board } from "./board.ts";
import type { Card } from "./card.ts";
import { EMPTY_CARD_FILTER } from "./cardFilter.ts";
import { listCardTableRows } from "./cardTable.ts";
import type { CardTableSort } from "./cardTable.ts";

function card(path: string, overrides: Partial<Card> = {}): Card {
  return {
    path,
    fileState: "available",
    labels: [],
    displayTitle: path,
    ...overrides,
  };
}

function board(columns: Board["columns"], labels: string[] = []): Board {
  return {
    version: 1,
    name: "Test",
    columns,
    labels: labels.map((name) => ({ name, color: "ruby" })),
  };
}

function paths(value: Board, sort?: CardTableSort) {
  return listCardTableRows(value, EMPTY_CARD_FILTER, sort).map((row) =>
    row.card.path
  );
}

describe("listCardTableRows", () => {
  it("uses board order without sorting and preserves source positions", () => {
    const value = board([
      { id: "left", name: "Left", cards: [card("b"), card("a")] },
      { id: "right", name: "Right", cards: [card("c")] },
    ]);

    expect(
      listCardTableRows(value, EMPTY_CARD_FILTER, undefined).map((
        row,
      ) => [row.card.path, row.column.id, row.columnIndex, row.cardIndex]),
    ).toEqual([
      ["b", "left", 0, 0],
      ["a", "left", 0, 1],
      ["c", "right", 1, 0],
    ]);
  });

  it("sorts title and path naturally without case distinctions", () => {
    const value = board([{
      id: "one",
      name: "One",
      cards: [
        card("file-10.md", { displayTitle: "task-10" }),
        card("File-2.md", { displayTitle: "Task-2" }),
        card("file-1.md", { displayTitle: "task-1" }),
      ],
    }]);

    expect(paths(value, { key: "title", direction: "asc" })).toEqual([
      "file-1.md",
      "File-2.md",
      "file-10.md",
    ]);
    expect(paths(value, { key: "title", direction: "desc" })).toEqual([
      "file-10.md",
      "File-2.md",
      "file-1.md",
    ]);
    expect(paths(value, { key: "path", direction: "asc" })).toEqual([
      "file-1.md",
      "File-2.md",
      "file-10.md",
    ]);
    expect(paths(value, { key: "path", direction: "desc" })).toEqual([
      "file-10.md",
      "File-2.md",
      "file-1.md",
    ]);
  });

  it("uses column order and keeps ties in board order when descending", () => {
    const value = board([
      {
        id: "first",
        name: "Z",
        cards: [
          card("a", { displayTitle: "same" }),
          card("b", { displayTitle: "same" }),
        ],
      },
      { id: "second", name: "A", cards: [card("c", { displayTitle: "same" })] },
    ]);

    expect(paths(value, { key: "column", direction: "asc" })).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(paths(value, { key: "column", direction: "desc" })).toEqual([
      "c",
      "a",
      "b",
    ]);
    expect(paths(value, { key: "title", direction: "desc" })).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("sorts priority high to low and leaves empty values last both ways", () => {
    const value = board([{
      id: "one",
      name: "One",
      cards: [
        card("none-1"),
        card("low", { priority: "low" }),
        card("high", { priority: "high" }),
        card("none-2"),
        card("medium", { priority: "medium" }),
      ],
    }]);

    expect(paths(value, { key: "priority", direction: "asc" })).toEqual([
      "high",
      "medium",
      "low",
      "none-1",
      "none-2",
    ]);
    expect(paths(value, { key: "priority", direction: "desc" })).toEqual([
      "low",
      "medium",
      "high",
      "none-1",
      "none-2",
    ]);
  });

  it("ranks unknown priorities after known ones and by name", () => {
    // Loading accepts any string as a priority, so a hand-edited board can
    // carry one outside the union.
    const unknown = (value: string) => value as Card["priority"];
    const value = board([{
      id: "one",
      name: "One",
      cards: [
        card("none"),
        card("urgent", { priority: unknown("urgent") }),
        card("low", { priority: "low" }),
        card("blocker", { priority: unknown("blocker") }),
        card("high", { priority: "high" }),
      ],
    }]);

    expect(paths(value, { key: "priority", direction: "asc" })).toEqual([
      "high",
      "low",
      "blocker",
      "urgent",
      "none",
    ]);
    expect(paths(value, { key: "priority", direction: "desc" })).toEqual([
      "urgent",
      "blocker",
      "low",
      "high",
      "none",
    ]);
  });

  it("sorts labels by registry sequence, prefixes, then unknown names", () => {
    const value = board([{
      id: "one",
      name: "One",
      cards: [
        card("empty"),
        card("unknown-z", { labels: ["zulu"] }),
        card("bug-docs", { labels: ["docs", "bug"] }),
        card("feature", { labels: ["feature"] }),
        card("bug", { labels: ["bug"] }),
        card("unknown-a", { labels: ["alpha"] }),
        card("bug-feature", { labels: ["feature", "bug"] }),
      ],
    }], ["bug", "feature", "docs"]);

    expect(paths(value, { key: "labels", direction: "asc" })).toEqual([
      "bug",
      "bug-feature",
      "bug-docs",
      "feature",
      "unknown-a",
      "unknown-z",
      "empty",
    ]);
    expect(paths(value, { key: "labels", direction: "desc" })).toEqual([
      "unknown-z",
      "unknown-a",
      "feature",
      "bug-docs",
      "bug-feature",
      "bug",
      "empty",
    ]);
  });

  it("filters labels, priority, and hidden columns from the rows", () => {
    const value = board([
      {
        id: "left",
        name: "Left",
        cards: [
          card("match", { labels: ["bug"], priority: "high" }),
          card("wrong-label", { labels: ["docs"], priority: "high" }),
          card("wrong-priority", { labels: ["bug"], priority: "low" }),
        ],
      },
      {
        id: "right",
        name: "Right",
        cards: [card("hidden", { labels: ["bug"], priority: "high" })],
      },
    ]);

    expect(
      listCardTableRows(value, {
        labels: new Set(["bug"]),
        priority: "high",
        hiddenColumnIds: new Set(["right"]),
      }, undefined).map((row) => row.card.path),
    ).toEqual(["match"]);
  });
});
