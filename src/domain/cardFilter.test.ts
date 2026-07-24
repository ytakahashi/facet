import { describe, expect, it } from "vitest";
import type { Card } from "./card.ts";
import {
  cardMatchesFilter,
  EMPTY_CARD_FILTER,
  filterCardsPreservingIndex,
  isCardFilterActive,
} from "./cardFilter.ts";

function makeCard(path: string, priority?: Card["priority"]): Card {
  return {
    path,
    priority,
    labels: [],
    displayTitle: path,
  };
}

describe("card filters", () => {
  it("is active only when a priority is selected", () => {
    expect(isCardFilterActive(EMPTY_CARD_FILTER)).toBe(false);
    expect(isCardFilterActive({ priority: "high" })).toBe(true);
  });

  it("matches every card without a selected priority", () => {
    expect(cardMatchesFilter(makeCard("unprioritized.md"), EMPTY_CARD_FILTER))
      .toBe(true);
    expect(
      cardMatchesFilter(makeCard("high.md", "high"), EMPTY_CARD_FILTER),
    ).toBe(true);
  });

  it("matches only cards with the selected priority", () => {
    expect(cardMatchesFilter(makeCard("high.md", "high"), {
      priority: "high",
    })).toBe(true);
    expect(cardMatchesFilter(makeCard("low.md", "low"), {
      priority: "high",
    })).toBe(false);
    expect(cardMatchesFilter(makeCard("none.md"), { priority: "high" }))
      .toBe(false);
  });

  it("keeps each matching card's index in the source array", () => {
    const cards = [
      makeCard("low.md", "low"),
      makeCard("high-a.md", "high"),
      makeCard("medium.md", "medium"),
      makeCard("high-b.md", "high"),
    ];

    expect(filterCardsPreservingIndex(cards, { priority: "high" })).toEqual([
      { card: cards[1], index: 1 },
      { card: cards[3], index: 3 },
    ]);
  });

  it("returns no cards when none match", () => {
    expect(
      filterCardsPreservingIndex([makeCard("low.md", "low")], {
        priority: "high",
      }),
    ).toEqual([]);
  });
});
