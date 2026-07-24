import { describe, expect, it } from "vitest";
import type { Card } from "./card.ts";
import {
  cardMatchesFilter,
  EMPTY_CARD_FILTER,
  filterCardsPreservingIndex,
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

describe("card filters", () => {
  it("is active only when a priority or a label is selected", () => {
    expect(isCardFilterActive(EMPTY_CARD_FILTER)).toBe(false);
    expect(isCardFilterActive({ labels: new Set(), priority: "high" })).toBe(
      true,
    );
    expect(isCardFilterActive({ labels: new Set(["bug"]) })).toBe(true);
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
      labels: new Set(),
      priority: "high",
    })).toBe(true);
    expect(cardMatchesFilter(makeCard("low.md", "low"), {
      labels: new Set(),
      priority: "high",
    })).toBe(false);
    expect(
      cardMatchesFilter(makeCard("none.md"), {
        labels: new Set(),
        priority: "high",
      }),
    ).toBe(false);
  });

  it("matches only cards carrying every selected label (AND)", () => {
    const criteria = { labels: new Set(["bug", "urgent"]) };
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
    const criteria = { labels: new Set(["bug"]), priority: "high" as const };
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

  it("keeps each matching card's index in the source array", () => {
    const cards = [
      makeCard("low.md", "low"),
      makeCard("high-a.md", "high"),
      makeCard("medium.md", "medium"),
      makeCard("high-b.md", "high"),
    ];

    expect(
      filterCardsPreservingIndex(cards, {
        labels: new Set(),
        priority: "high",
      }),
    ).toEqual([
      { card: cards[1], index: 1 },
      { card: cards[3], index: 3 },
    ]);
  });

  it("returns no cards when none match", () => {
    expect(
      filterCardsPreservingIndex([makeCard("low.md", "low")], {
        labels: new Set(),
        priority: "high",
      }),
    ).toEqual([]);
  });
});
