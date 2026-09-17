import { describe, expect, it } from "vitest";
import type { Board, Column } from "./board.ts";
import type { Card } from "./card.ts";
import { searchCardContents } from "./cardContentSearch.ts";

function makeCard(path: string, displayTitle = path): Card {
  return {
    path,
    absolutePath: `/board/${path}`,
    fileState: "available",
    labels: [],
    displayTitle,
  };
}

function makeColumn(id: string, cards: Card[]): Column {
  return { id, name: `${id} column`, cards };
}

function makeBoard(columns: Column[]): Board {
  return { version: 1, name: "Board", labels: [], columns };
}

describe("searchCardContents", () => {
  it("matches case and Unicode composition without changing the displayed line", () => {
    const card = makeCard("screen.md");
    const board = makeBoard([makeColumn("todo", [card])]);
    const contents = new Map([[card.path, "Open the がめん in FACET"]]);

    const result = searchCardContents(board, contents, " がめん ");

    expect(result).toEqual([{
      card,
      columnId: "todo",
      columnName: "todo column",
      lines: [{
        lineNumber: 1,
        snippet: "Open the がめん in FACET",
        truncatedStart: false,
        truncatedEnd: false,
        ranges: [{ start: 9, end: 12 }],
      }],
      totalLineCount: 1,
    }]);
  });

  it("keeps line whitespace significant and returns every non-overlapping range", () => {
    const card = makeCard("notes.md");
    const board = makeBoard([makeColumn("todo", [card])]);
    const contents = new Map([[card.path, "  aa aa aaa  "]]);

    const result = searchCardContents(board, contents, "aa");

    expect(result[0].lines[0]).toMatchObject({
      snippet: "  aa aa aaa  ",
      ranges: [
        { start: 2, end: 4 },
        { start: 5, end: 7 },
        { start: 8, end: 10 },
      ],
    });
  });

  it("reports one-based line numbers for CRLF content", () => {
    const card = makeCard("notes.md");
    const board = makeBoard([makeColumn("todo", [card])]);
    const contents = new Map([[card.path, "first\r\nfind this\r\nlast"]]);

    const result = searchCardContents(board, contents, "find");

    expect(result[0].lines[0]).toMatchObject({
      lineNumber: 2,
      snippet: "find this",
      ranges: [{ start: 0, end: 4 }],
    });
  });

  it("does not match a query across line boundaries", () => {
    const card = makeCard("notes.md");
    const board = makeBoard([makeColumn("todo", [card])]);
    const contents = new Map([[card.path, "first line\nsecond line"]]);

    const result = searchCardContents(board, contents, "line\nsecond");

    expect(result).toEqual([]);
  });

  it("returns a hit without ranges when case folding changes line length", () => {
    const card = makeCard("international.md");
    const board = makeBoard([makeColumn("todo", [card])]);
    const line = `${"x".repeat(50)}İ${"y".repeat(100)}`;
    const contents = new Map([[card.path, line]]);

    const result = searchCardContents(board, contents, "İ");

    expect(result[0].lines[0].ranges).toEqual([]);
    expect(result[0].lines[0].snippet).toContain("İ");
    expect(result[0].lines[0].truncatedStart).toBe(true);
    expect(result[0].lines[0].truncatedEnd).toBe(true);
  });

  it("truncates on code-point boundaries and translates ranges to the snippet", () => {
    const card = makeCard("emoji.md");
    const board = makeBoard([makeColumn("todo", [card])]);
    const line = `${"😀".repeat(40)}needle${"z".repeat(100)}`;
    const contents = new Map([[card.path, line]]);

    const result = searchCardContents(board, contents, "needle");
    const hit = result[0].lines[0];

    expect(Array.from(hit.snippet)).toHaveLength(120);
    expect(hit.snippet).not.toContain("�");
    expect(hit.ranges).toEqual([{ start: 60, end: 66 }]);
    expect(hit.truncatedStart).toBe(true);
    expect(hit.truncatedEnd).toBe(true);
  });

  it("keeps only the first three matching lines while counting every match", () => {
    const card = makeCard("many.md");
    const board = makeBoard([makeColumn("todo", [card])]);
    const contents = new Map([[
      card.path,
      "match one\nmatch two\nmatch three\nmatch four",
    ]]);

    const result = searchCardContents(board, contents, "match");

    expect(result[0].lines.map((line) => line.lineNumber)).toEqual([1, 2, 3]);
    expect(result[0].totalLineCount).toBe(4);
  });

  it("returns cards in board order and skips cards without readable content", () => {
    const first = makeCard("first.md");
    const unreadable = makeCard("unreadable.md");
    const second = makeCard("second.md");
    const board = makeBoard([
      makeColumn("todo", [first, unreadable]),
      makeColumn("done", [second]),
    ]);
    const contents = new Map([
      [second.path, "target"],
      [first.path, "target"],
    ]);

    const result = searchCardContents(board, contents, "target");

    expect(result.map((hit) => hit.card.path)).toEqual([
      first.path,
      second.path,
    ]);
  });

  it("aggregates matching lines independently for each card", () => {
    const first = makeCard("first.md");
    const second = makeCard("second.md");
    const board = makeBoard([makeColumn("todo", [first, second])]);
    const contents = new Map([
      [first.path, "match one\nmatch two\nmatch three\nmatch four"],
      [second.path, "match five\nnot this one\nmatch six"],
    ]);

    const result = searchCardContents(board, contents, "match");

    expect(result.map((hit) => ({
      path: hit.card.path,
      lineNumbers: hit.lines.map((line) => line.lineNumber),
      totalLineCount: hit.totalLineCount,
    }))).toEqual([
      {
        path: first.path,
        lineNumbers: [1, 2, 3],
        totalLineCount: 4,
      },
      {
        path: second.path,
        lineNumbers: [1, 3],
        totalLineCount: 2,
      },
    ]);
  });

  it("returns no hits for an empty or whitespace-only query", () => {
    const card = makeCard("notes.md");
    const board = makeBoard([makeColumn("todo", [card])]);
    const contents = new Map([[card.path, "content"]]);

    expect(searchCardContents(board, contents, "")).toEqual([]);
    expect(searchCardContents(board, contents, "   ")).toEqual([]);
  });
});
