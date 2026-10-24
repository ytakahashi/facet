import { describe, expect, it } from "vite-plus/test";
import {
  CARD_HISTORY_LIMIT,
  type CardHistory,
  emptyCardHistory,
  findPreviousCard,
  listRecentCards,
  recordCardVisit,
  removeFromCardHistory,
  retargetCardHistory,
} from "./cardHistory.ts";

function record(paths: readonly string[]): CardHistory {
  return paths.reduce(recordCardVisit, emptyCardHistory());
}

const onBoard = () => true;

function recent(history: CardHistory) {
  return listRecentCards(history, onBoard);
}

describe("card history", () => {
  it("moves visits to the front and removes equivalent identities throughout the list", () => {
    const history = record([
      "a.md",
      "café.md",
      "b.md",
      "folder/../A.md",
      "cafe\u0301.md",
    ]);

    expect(recent(history)).toEqual([
      "cafe\u0301.md",
      "folder/../A.md",
      "b.md",
    ]);
  });

  it("counts the current card toward the ten-entry limit and drops the oldest", () => {
    const paths = Array.from({ length: 12 }, (_, index) => `${index}.md`);
    const history = record(paths);

    expect(CARD_HISTORY_LIMIT).toBe(10);
    expect(recent(history)).toEqual(paths.slice(2).reverse());
    expect(recent(recordCardVisit(history, "5.md"))).toEqual([
      "5.md",
      ...paths
        .slice(2)
        .reverse()
        .filter((path) => path !== "5.md"),
    ]);
  });

  it("lists only cards on the board without changing the stored history", () => {
    const history = record(["a.md", "gone.md", "b.md", "removed-current.md"]);
    expect(
      listRecentCards(history, (path) => path === "a.md" || path === "b.md"),
    ).toEqual(["b.md", "a.md"]);
    expect(recent(history)).toEqual([
      "removed-current.md",
      "b.md",
      "gone.md",
      "a.md",
    ]);
  });

  it("has no destination with empty history or only the current card", () => {
    expect(
      findPreviousCard(emptyCardHistory(), undefined, onBoard),
    ).toBeUndefined();
    expect(findPreviousCard(record(["a.md"]), "a.md", onBoard)).toBeUndefined();
    expect(
      findPreviousCard(record(["a.md"]), undefined, () => false),
    ).toBeUndefined();
  });

  it("reopens the most recent remaining card when the viewer is closed", () => {
    const history = record(["a.md", "b.md", "gone.md"]);
    expect(
      findPreviousCard(history, undefined, (path) => path !== "gone.md"),
    ).toBe("b.md");
    expect(findPreviousCard(record(["a.md"]), undefined, onBoard)).toBe("a.md");
  });

  it("excludes the current card by identity wherever it appears in history", () => {
    const history = record(["a.md", "café.md", "b.md"]);
    expect(findPreviousCard(history, "folder/../B.md", onBoard)).toBe(
      "café.md",
    );
    expect(findPreviousCard(history, "cafe\u0301.md", onBoard)).toBe("b.md");
    expect(findPreviousCard(history, "unrecorded.md", onBoard)).toBe("b.md");
  });

  it("skips removed cards, including a removed current card", () => {
    const history = record(["a.md", "gone.md", "b.md", "current.md"]);
    const retained = (path: string) => path === "a.md" || path === "b.md";
    expect(findPreviousCard(history, "current.md", retained)).toBe("b.md");
    expect(findPreviousCard(history, "b.md", retained)).toBe("a.md");
    expect(
      findPreviousCard(history, "current.md", (path) => path === "current.md"),
    ).toBeUndefined();
  });

  it("toggles between the last two cards by recording each destination", () => {
    let history = record(["a.md", "b.md", "c.md"]);
    const previous = findPreviousCard(history, "c.md", onBoard)!;
    history = recordCardVisit(history, previous);
    expect(recent(history)).toEqual(["b.md", "c.md", "a.md"]);
    expect(findPreviousCard(history, previous, onBoard)).toBe("c.md");
  });

  it("retargets equivalent paths and keeps the most recent of nonadjacent collisions", () => {
    const history = record(["old.md", "a.md", "next.md", "b.md"]);
    const retargeted = retargetCardHistory(history, "OLD.md", "NEXT.md");
    expect(recent(retargeted)).toEqual(["b.md", "next.md", "a.md"]);
    expect(
      recent(
        retargetCardHistory(
          record(["next.md", "a.md", "old.md"]),
          "old.md",
          "NEXT.md",
        ),
      ),
    ).toEqual(["NEXT.md", "a.md"]);
    expect(recent(history)).toEqual(["b.md", "next.md", "a.md", "old.md"]);
  });

  it("removes an equivalent path without changing the order of remaining cards", () => {
    const history = record(["a.md", "remove.md", "b.md"]);
    expect(
      recent(removeFromCardHistory(history, "folder/../REMOVE.md")),
    ).toEqual(["b.md", "a.md"]);
    expect(recent(history)).toEqual(["b.md", "remove.md", "a.md"]);
  });
});
