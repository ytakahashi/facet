import { describe, expect, it } from "vite-plus/test";
import type { Board } from "../../domain/board.ts";
import type { Card } from "../../domain/card.ts";
import {
  emptyCardHistory,
  findPreviousCard,
  listRecentCards,
  recordCardVisit,
} from "../../domain/cardHistory.ts";
import {
  type CardSearchHit,
  listRecentCardHits,
  searchCardsByTitle,
} from "../../domain/cardSearch.ts";
import { nextSelectionIndex } from "../shared/cardSearchSelection.ts";
import { buildCardSearchModel } from "./cardSearchModel.ts";

function makeCard(displayTitle: string): Card {
  return {
    path: `${displayTitle}.md`,
    fileState: "available",
    labels: [],
    displayTitle,
  };
}

const a = makeCard("A");
const b = makeCard("B");
const c = makeCard("C");
const d = makeCard("D");
const board: Board = {
  version: 1,
  name: "Board",
  labels: [],
  columns: [
    { id: "todo", name: "Todo", cards: [a, b] },
    { id: "done", name: "Done", cards: [c, d] },
  ],
};

function recentOf(...cards: Card[]): CardSearchHit[] {
  return listRecentCardHits(
    board,
    cards.map((card) => card.path),
  );
}

function build(
  recent: CardSearchHit[],
  currentPath: string | undefined,
  query = "",
) {
  return buildCardSearchModel({
    query,
    results: searchCardsByTitle(board, query),
    recent,
    currentPath,
  });
}

function sectionPaths(model: ReturnType<typeof build>) {
  return model.sections.map((section) => ({
    kind: section.kind,
    rows: section.rows.map((row) => `${row.kind}:${row.hit.card.path}`),
  }));
}

function optionPaths(model: ReturnType<typeof build>): string[] {
  return model.options.map((row) => row.hit.card.path);
}

describe("buildCardSearchModel", () => {
  it("lists recent cards above the board and skips the current one", () => {
    const model = build(recentOf(c, b, a), c.path);

    expect(sectionPaths(model)).toEqual([
      {
        kind: "recent",
        rows: ["current:C.md", "option:B.md", "option:A.md"],
      },
      {
        kind: "all",
        rows: ["option:A.md", "option:B.md", "option:C.md", "option:D.md"],
      },
    ]);
    expect(optionPaths(model)).toEqual([
      "B.md",
      "A.md",
      "A.md",
      "B.md",
      "C.md",
      "D.md",
    ]);
  });

  it("skips the current card wherever it sits in the recent list", () => {
    const model = build(recentOf(b, c, a), c.path);

    expect(sectionPaths(model)[0]).toEqual({
      kind: "recent",
      rows: ["option:B.md", "current:C.md", "option:A.md"],
    });
    expect(model.options.map((row) => row.optionIndex)).toEqual([
      0, 1, 2, 3, 4, 5,
    ]);
  });

  it("recognises the current card by an equivalent path", () => {
    const model = build(recentOf(c, b), "c.MD");

    expect(model.sections[0]?.rows[0]?.kind).toBe("current");
  });

  it("starts at the most recent card while the viewer is closed", () => {
    const model = build(recentOf(c, b), undefined);

    expect(sectionPaths(model)[0]).toEqual({
      kind: "recent",
      rows: ["option:C.md", "option:B.md"],
    });
    expect(model.options[0]?.hit.card).toBe(c);
  });

  it("falls through to the board when only the current card is recent", () => {
    const model = build(recentOf(c), c.path);

    expect(sectionPaths(model)[0]).toEqual({
      kind: "recent",
      rows: ["current:C.md"],
    });
    expect(model.options[0]?.hit.card).toBe(a);
  });

  it("shows the plain list without history", () => {
    const model = build([], undefined);

    expect(sectionPaths(model)).toEqual([
      {
        kind: "results",
        rows: ["option:A.md", "option:B.md", "option:C.md", "option:D.md"],
      },
    ]);
  });

  it("shows nothing for an empty board", () => {
    const model = buildCardSearchModel({
      query: "",
      results: [],
      recent: [],
      currentPath: undefined,
    });

    expect(model).toEqual({ sections: [], options: [] });
  });

  it("drops the recent list once a query is typed and keeps board order", () => {
    const model = build(recentOf(c, b), c.path, "c");

    expect(sectionPaths(model)).toEqual([
      { kind: "results", rows: ["option:C.md"] },
    ]);
  });

  it("treats a query of only whitespace as empty", () => {
    const model = build(recentOf(c, b), c.path, "   ");

    expect(model.sections.map((section) => section.kind)).toEqual([
      "recent",
      "all",
    ]);
  });

  it("moves past the current card and wraps from the last option", () => {
    const model = build(recentOf(b, c, a), c.path);
    const count = model.options.length;

    const visited = [0];
    for (let step = 0; step < count; step++) {
      visited.push(nextSelectionIndex(visited.at(-1) ?? 0, count, 1));
    }

    expect(visited.map((index) => model.options[index]?.hit.card.path)).toEqual(
      ["B.md", "A.md", "A.md", "B.md", "C.md", "D.md", "B.md"],
    );
  });

  it("gives every row its own id, even for a card listed twice", () => {
    const model = build(recentOf(c, b, a), c.path);
    const ids = model.sections.flatMap((section) =>
      section.rows.map((row) => row.id),
    );
    const keys = model.sections.flatMap((section) =>
      section.rows.map((row) => row.key),
    );

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("orders options as the same rows the sections render", () => {
    const model = build(recentOf(b, c, a), c.path);
    const rendered = model.sections.flatMap((section) =>
      section.rows.filter((row) => row.kind === "option"),
    );

    expect(rendered).toHaveLength(model.options.length);
    rendered.forEach((row, index) => {
      expect(model.options[index]).toBe(row);
    });
  });

  it("selects first the card Command-[ would switch to", () => {
    let history = emptyCardHistory();
    for (const card of [a, b, c]) {
      history = recordCardVisit(history, card.path);
    }
    const isOnBoard = () => true;

    const model = build(
      listRecentCardHits(board, listRecentCards(history, isOnBoard)),
      c.path,
    );

    expect(model.options[0]?.hit.card.path).toBe(
      findPreviousCard(history, c.path, isOnBoard),
    );
  });
});
