import { describe, expect, it } from "vitest";
import {
  CARD_HISTORY_LIMIT,
  type CardHistory,
  emptyCardHistory,
  findPreviousCard,
  recordCardVisit,
  removeFromCardHistory,
  retargetCardHistory,
} from "./cardHistory.ts";

function record(paths: readonly string[]): CardHistory {
  return paths.reduce(recordCardVisit, emptyCardHistory());
}

function backPaths(
  history: CardHistory,
  isOnBoard: (path: string) => boolean = () => true,
): string[] {
  const paths: string[] = [];
  let current = history;
  for (let step = 0; step < CARD_HISTORY_LIMIT; step++) {
    const previous = findPreviousCard(current, isOnBoard);
    if (!previous) return paths;
    paths.push(previous.path);
    current = previous.history;
  }
  throw new Error("Going back did not reduce card history");
}

describe("card history", () => {
  it("returns visits in reverse order without repeating adjacent identities", () => {
    const history = record([
      "a.md",
      "folder/../A.md",
      "b.md",
      "cafe\u0301.md",
      "caf\u00e9.md",
      "c.md",
    ]);

    expect(backPaths(history)).toEqual(["cafe\u0301.md", "b.md", "a.md"]);
  });

  it("keeps only the most recent visits when the limit is exceeded", () => {
    const paths = Array.from(
      { length: CARD_HISTORY_LIMIT + 2 },
      (_, index) => `${index}.md`,
    );

    const history = record(paths);
    const result = backPaths(history);

    expect(result).toHaveLength(CARD_HISTORY_LIMIT - 1);
    expect(result.at(-1)).toBe("2.md");
  });

  it("has nowhere to go back from an empty or single-entry history", () => {
    expect(findPreviousCard(emptyCardHistory(), () => true)).toBeUndefined();
    expect(findPreviousCard(record(["a.md"]), () => true)).toBeUndefined();
  });

  it("drops the current entry before skipping cards no longer on the board", () => {
    const history = record(["a.md", "gone.md", "b.md", "current.md"]);
    const isOnBoard = (path: string) => path === "a.md" || path === "b.md";

    expect(backPaths(history, isOnBoard)).toEqual(["b.md", "a.md"]);
  });

  it("can return from a current card that is no longer on the board", () => {
    const history = record(["a.md", "removed-current.md"]);

    expect(findPreviousCard(history, (path) => path === "a.md")?.path).toBe(
      "a.md",
    );
  });

  it("returns undefined when no earlier card remains on the board", () => {
    const history = record(["gone.md", "current.md"]);

    expect(findPreviousCard(history, (path) => path === "current.md"))
      .toBeUndefined();
  });

  it("retargets every visit and collapses adjacent identities", () => {
    const history = record(["a.md", "old.md", "b.md", "OLD.md", "next.md"]);
    const retargeted = retargetCardHistory(history, "old.md", "b.md");

    expect(backPaths(retargeted)).toEqual(["b.md", "a.md"]);
  });

  it("removes every visit and collapses the entries it joins", () => {
    const history = record(["a.md", "remove.md", "A.md", "current.md"]);
    const removed = removeFromCardHistory(history, "REMOVE.md");

    expect(backPaths(removed)).toEqual(["a.md"]);
  });
});
