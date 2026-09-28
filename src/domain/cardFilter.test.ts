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
  isCardHidden,
} from "./cardFilter.ts";

function makeCard(path: string, labels: string[] = []): Card {
  return {
    path,
    fileState: "available",
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
  it("is active only when a label or a column is selected", () => {
    const board = makeBoard([makeColumn("done")]);

    expect(isCardFilterActive(board, EMPTY_CARD_FILTER)).toBe(false);
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

  it("matches every card without a selected label", () => {
    expect(cardMatchesFilter(makeCard("unlabeled.md"), EMPTY_CARD_FILTER))
      .toBe(true);
    expect(cardMatchesFilter(makeCard("bug.md", ["bug"]), EMPTY_CARD_FILTER))
      .toBe(true);
  });

  it("matches only cards carrying every selected label (AND)", () => {
    const criteria = makeCriteria({ labels: new Set(["bug", "urgent"]) });

    expect(cardMatchesFilter(makeCard("both.md", ["bug", "urgent"]), criteria))
      .toBe(true);
    expect(cardMatchesFilter(makeCard("one.md", ["bug"]), criteria)).toBe(
      false,
    );
    expect(cardMatchesFilter(makeCard("none.md"), criteria)).toBe(false);
  });

  it("reports a column as hidden only while its id is selected", () => {
    const column = makeColumn("done", [makeCard("shipped.md")]);
    const criteria = makeCriteria({ hiddenColumnIds: new Set(["done"]) });

    expect(areColumnCardsHidden(column, criteria)).toBe(true);
    expect(areColumnCardsHidden(makeColumn("doing"), criteria)).toBe(false);
  });

  it("reports a card as hidden by its column or by its own fields", () => {
    const card = makeCard("shipped.md", ["bug"]);
    const hiddenColumn = makeCriteria({ hiddenColumnIds: new Set(["done"]) });
    const otherLabel = makeCriteria({ labels: new Set(["chore"]) });

    expect(isCardHidden(card, "done", hiddenColumn)).toBe(true);
    expect(isCardHidden(card, "done", otherLabel)).toBe(true);
    expect(isCardHidden(card, "done", EMPTY_CARD_FILTER)).toBe(false);
    expect(isCardHidden(card, "doing", hiddenColumn)).toBe(false);
  });

  it("keeps each matching card's index in the column's card array", () => {
    const cards = [
      makeCard("chore.md", ["chore"]),
      makeCard("bug-a.md", ["bug"]),
      makeCard("unlabeled.md"),
      makeCard("bug-b.md", ["bug"]),
    ];
    const column = makeColumn("doing", cards);
    const criteria = makeCriteria({ labels: new Set(["bug"]) });

    const result = filterColumnCards(column, criteria);

    expect(result).toEqual([
      { card: cards[1], index: 1 },
      { card: cards[3], index: 3 },
    ]);
  });

  it("returns no cards when none match", () => {
    const column = makeColumn("doing", [makeCard("chore.md", ["chore"])]);
    const criteria = makeCriteria({ labels: new Set(["bug"]) });

    const result = filterColumnCards(column, criteria);

    expect(result).toEqual([]);
  });

  it("returns no cards from a hidden column, whatever the card conditions", () => {
    const column = makeColumn("done", [makeCard("shipped.md", ["bug"])]);
    const criteria = makeCriteria({
      labels: new Set(["bug"]),
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
