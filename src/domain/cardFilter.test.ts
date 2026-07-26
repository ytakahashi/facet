import { describe, expect, it } from "vitest";
import type { Board, Column } from "./board.ts";
import type { Card } from "./card.ts";
import {
  areColumnCardsHidden,
  type CardFilterCriteria,
  cardMatchesFilter,
  EMPTY_CARD_FILTER,
  filterColumnCards,
  isCardFilterActive,
} from "./cardFilter.ts";

function makeCard(
  path: string,
  priority?: Card["priority"],
  labels: string[] = [],
): Card {
  return {
    path,
    priority,
    labels,
    displayTitle: path,
  };
}

function makeColumn(id: string, cards: Card[] = []): Column {
  return { id, name: id, cards };
}

function makeBoard(columns: Column[]): Board {
  return { version: 1, name: "Board", labels: [], columns };
}

function makeCriteria(
  overrides: Partial<CardFilterCriteria> = {},
): CardFilterCriteria {
  return { ...EMPTY_CARD_FILTER, ...overrides };
}

describe("card filters", () => {
  it("is active only when a priority, a label, or a column is selected", () => {
    const board = makeBoard([makeColumn("done")]);

    expect(isCardFilterActive(board, EMPTY_CARD_FILTER)).toBe(false);
    expect(isCardFilterActive(board, makeCriteria({ priority: "high" })))
      .toBe(true);
    expect(
      isCardFilterActive(board, makeCriteria({ labels: new Set(["bug"]) })),
    ).toBe(true);
    expect(
      isCardFilterActive(
        board,
        makeCriteria({ hiddenColumnIds: new Set(["done"]) }),
      ),
    ).toBe(true);
  });

  it("is inactive when only columns the board no longer has are hidden", () => {
    const board = makeBoard([makeColumn("doing")]);
    const criteria = makeCriteria({
      hiddenColumnIds: new Set(["removed-column"]),
    });

    const result = isCardFilterActive(board, criteria);

    expect(result).toBe(false);
  });

  it("matches every card without a selected priority", () => {
    expect(cardMatchesFilter(makeCard("unprioritized.md"), EMPTY_CARD_FILTER))
      .toBe(true);
    expect(
      cardMatchesFilter(makeCard("high.md", "high"), EMPTY_CARD_FILTER),
    ).toBe(true);
  });

  it("matches only cards with the selected priority", () => {
    const criteria = makeCriteria({ priority: "high" });

    expect(cardMatchesFilter(makeCard("high.md", "high"), criteria)).toBe(true);
    expect(cardMatchesFilter(makeCard("low.md", "low"), criteria)).toBe(false);
    expect(cardMatchesFilter(makeCard("none.md"), criteria)).toBe(false);
  });

  it("matches only cards carrying every selected label (AND)", () => {
    const criteria = makeCriteria({ labels: new Set(["bug", "urgent"]) });

    expect(
      cardMatchesFilter(
        makeCard("both.md", undefined, ["bug", "urgent"]),
        criteria,
      ),
    )
      .toBe(true);
    expect(
      cardMatchesFilter(makeCard("one.md", undefined, ["bug"]), criteria),
    ).toBe(false);
    expect(cardMatchesFilter(makeCard("none.md"), criteria)).toBe(false);
  });

  it("matches only cards satisfying both label and priority conditions", () => {
    const criteria = makeCriteria({
      labels: new Set(["bug"]),
      priority: "high",
    });

    expect(
      cardMatchesFilter(makeCard("match.md", "high", ["bug"]), criteria),
    ).toBe(true);
    expect(
      cardMatchesFilter(
        makeCard("wrong-priority.md", "low", ["bug"]),
        criteria,
      ),
    ).toBe(false);
    expect(
      cardMatchesFilter(makeCard("missing-label.md", "high"), criteria),
    ).toBe(false);
  });

  it("reports a column as hidden only while its id is selected", () => {
    const column = makeColumn("done", [makeCard("shipped.md")]);
    const criteria = makeCriteria({ hiddenColumnIds: new Set(["done"]) });

    expect(areColumnCardsHidden(column, criteria)).toBe(true);
    expect(areColumnCardsHidden(makeColumn("doing"), criteria)).toBe(false);
  });

  it("keeps each matching card's index in the column's card array", () => {
    const cards = [
      makeCard("low.md", "low"),
      makeCard("high-a.md", "high"),
      makeCard("medium.md", "medium"),
      makeCard("high-b.md", "high"),
    ];
    const column = makeColumn("doing", cards);
    const criteria = makeCriteria({ priority: "high" });

    const result = filterColumnCards(column, criteria);

    expect(result).toEqual([
      { card: cards[1], index: 1 },
      { card: cards[3], index: 3 },
    ]);
  });

  it("returns no cards when none match", () => {
    const column = makeColumn("doing", [makeCard("low.md", "low")]);
    const criteria = makeCriteria({ priority: "high" });

    const result = filterColumnCards(column, criteria);

    expect(result).toEqual([]);
  });

  it("returns no cards from a hidden column, whatever the card conditions", () => {
    const column = makeColumn("done", [
      makeCard("shipped.md", "high", ["bug"]),
    ]);
    const criteria = makeCriteria({
      labels: new Set(["bug"]),
      priority: "high",
      hiddenColumnIds: new Set(["done"]),
    });

    const result = filterColumnCards(column, criteria);

    expect(result).toEqual([]);
  });

  it("leaves other columns untouched when one column is hidden", () => {
    const cards = [makeCard("planned.md")];
    const column = makeColumn("ideas", cards);
    const criteria = makeCriteria({ hiddenColumnIds: new Set(["done"]) });

    const result = filterColumnCards(column, criteria);

    expect(result).toEqual([{ card: cards[0], index: 0 }]);
  });
});
