import { describe, expect, it } from "vite-plus/test";
import type { Board, Column } from "./board.ts";
import type { Card } from "./card.ts";
import { listRecentCardHits, searchCardsByTitle } from "./cardSearch.ts";

// "がめん" spelled two ways: the dakuten as its own combining character, as
// a file name read back from macOS arrives, and as a single character, as
// the same word typed into the search box arrives.
const DECOMPOSED_TITLE = "がめん";
const COMPOSED_QUERY = "がめん";

function makeCard(displayTitle: string, path = `${displayTitle}.md`): Card {
  return { path, fileState: "available", labels: [], displayTitle };
}

function makeColumn(id: string, cards: Card[] = []): Column {
  return { id, name: id, cards };
}

function makeBoard(columns: Column[]): Board {
  return { version: 1, name: "Board", labels: [], columns };
}

describe("searchCardsByTitle", () => {
  it("matches a title containing the query anywhere", () => {
    const matching = makeCard("Rewrite the onboarding flow");
    const board = makeBoard([
      makeColumn("todo", [matching, makeCard("Ship the release")]),
    ]);

    const result = searchCardsByTitle(board, "onboarding");

    expect(result).toEqual([
      { card: matching, columnId: "todo", columnName: "todo" },
    ]);
  });

  it("matches regardless of letter case", () => {
    const card = makeCard("Design Review");
    const board = makeBoard([makeColumn("doing", [card])]);

    const result = searchCardsByTitle(board, "DESIGN");

    expect(result).toEqual([{ card, columnId: "doing", columnName: "doing" }]);
  });

  it("matches a decomposed title against a composed query", () => {
    const decomposed = makeCard(DECOMPOSED_TITLE, "memo.md");
    const board = makeBoard([makeColumn("todo", [decomposed])]);

    const result = searchCardsByTitle(board, COMPOSED_QUERY);

    expect(result).toEqual([
      { card: decomposed, columnId: "todo", columnName: "todo" },
    ]);
  });

  it("ignores whitespace around the query but not inside it", () => {
    const card = makeCard("Design review");
    const board = makeBoard([makeColumn("doing", [card])]);

    const padded = searchCardsByTitle(board, "  design review  ");
    const withInnerSpace = searchCardsByTitle(board, "design  review");

    expect(padded).toEqual([{ card, columnId: "doing", columnName: "doing" }]);
    expect(withInnerSpace).toEqual([]);
  });

  it("returns every card in board order for an empty query", () => {
    const first = makeCard("Plan the quarter");
    const second = makeCard("Draft the notes");
    const third = makeCard("Ship the release");
    const board = makeBoard([
      makeColumn("todo", [first, second]),
      makeColumn("done", [third]),
    ]);

    const result = searchCardsByTitle(board, "   ");

    expect(result).toEqual([
      { card: first, columnId: "todo", columnName: "todo" },
      { card: second, columnId: "todo", columnName: "todo" },
      { card: third, columnId: "done", columnName: "done" },
    ]);
  });

  it("orders hits by column and then by position within the column", () => {
    const doingHit = makeCard("Review the spec");
    const todoFirstHit = makeCard("Review the draft");
    const todoSecondHit = makeCard("Review the budget");
    const board = makeBoard([
      makeColumn("todo", [
        todoFirstHit,
        makeCard("Ship the release"),
        todoSecondHit,
      ]),
      makeColumn("doing", [doingHit]),
    ]);

    const result = searchCardsByTitle(board, "review");

    expect(result).toEqual([
      { card: todoFirstHit, columnId: "todo", columnName: "todo" },
      { card: todoSecondHit, columnId: "todo", columnName: "todo" },
      { card: doingHit, columnId: "doing", columnName: "doing" },
    ]);
  });

  it("returns nothing when no title contains the query", () => {
    const board = makeBoard([makeColumn("todo", [makeCard("Ship it")])]);

    const result = searchCardsByTitle(board, "onboarding");

    expect(result).toEqual([]);
  });
});

describe("listRecentCardHits", () => {
  it("keeps the order of the given paths rather than board order", () => {
    const first = makeCard("First");
    const second = makeCard("Second");
    const third = makeCard("Third");
    const board = makeBoard([
      makeColumn("todo", [first, second]),
      makeColumn("done", [third]),
    ]);

    const result = listRecentCardHits(board, [
      "Third.md",
      "First.md",
      "Second.md",
    ]);

    expect(result).toEqual([
      { card: third, columnId: "done", columnName: "done" },
      { card: first, columnId: "todo", columnName: "todo" },
      { card: second, columnId: "todo", columnName: "todo" },
    ]);
  });

  it("reports the column the card sits in now", () => {
    const moved = makeCard("Moved");
    const board = makeBoard([
      makeColumn("todo"),
      { id: "doing", name: "In progress", cards: [moved] },
    ]);

    const result = listRecentCardHits(board, ["Moved.md"]);

    expect(result).toEqual([
      { card: moved, columnId: "doing", columnName: "In progress" },
    ]);
  });

  it("resolves an equivalent path to the card as the board spells it", () => {
    const card = makeCard("Notes", "Notes/Plan.md");
    const board = makeBoard([makeColumn("todo", [card])]);

    const result = listRecentCardHits(board, ["notes/plan.md"]);

    expect(result).toEqual([{ card, columnId: "todo", columnName: "todo" }]);
  });

  it("skips a path the board no longer holds", () => {
    const kept = makeCard("Kept");
    const board = makeBoard([makeColumn("todo", [kept])]);

    const result = listRecentCardHits(board, ["Removed.md", "Kept.md"]);

    expect(result).toEqual([
      { card: kept, columnId: "todo", columnName: "todo" },
    ]);
  });

  it("keeps a card whose file is missing", () => {
    const missing: Card = { ...makeCard("Gone"), fileState: "missing" };
    const board = makeBoard([makeColumn("todo", [missing])]);

    const result = listRecentCardHits(board, ["Gone.md"]);

    expect(result).toEqual([
      { card: missing, columnId: "todo", columnName: "todo" },
    ]);
  });
});
