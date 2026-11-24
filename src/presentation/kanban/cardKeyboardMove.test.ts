import { describe, expect, it } from "vite-plus/test";
import { type Board, moveCard } from "../../domain/board.ts";
import type { Card } from "../../domain/card.ts";
import {
  type CardFilterCriteria,
  EMPTY_CARD_FILTER,
} from "../../domain/cardFilter.ts";
import type { CardMoveDirection } from "../shared/shortcuts/cardMoveShortcut.ts";
import { resolveCardStep } from "./cardKeyboardMove.ts";

function card(name: string, labels: string[] = ["visible"]): Card {
  return {
    path: name + ".md",
    displayTitle: name,
    fileState: "available",
    labels,
  };
}

function boardWith(cards: Card[]): Board {
  return {
    version: 1,
    name: "Test",
    labels: [],
    columns: [
      { id: "todo", name: "To do", cards },
      { id: "done", name: "Done", cards: [card("Other")] },
    ],
  };
}

const unfiltered = EMPTY_CARD_FILTER;
const visibleOnly: CardFilterCriteria = {
  labels: new Set(["visible"]),
  hiddenColumnIds: new Set(),
};

function stepAndApply(
  board: Board,
  path: string,
  direction: CardMoveDirection,
  criteria: CardFilterCriteria = unfiltered,
): string[] | undefined {
  const step = resolveCardStep(board, path, direction, criteria);
  if (!step) return undefined;
  return moveCard(board, step.from, step.to).columns[0].cards.map(
    (c) => c.displayTitle,
  );
}

describe("resolveCardStep", () => {
  const board = boardWith([card("A"), card("B"), card("C")]);

  it("moves a card before the previous card", () => {
    expect(stepAndApply(board, "B.md", "up")).toEqual(["B", "A", "C"]);
  });

  it("moves a card after the next card", () => {
    expect(stepAndApply(board, "B.md", "down")).toEqual(["A", "C", "B"]);
  });

  it("stops at the first and last cards", () => {
    expect(resolveCardStep(board, "A.md", "up", unfiltered)).toBeUndefined();
    expect(resolveCardStep(board, "C.md", "down", unfiltered)).toBeUndefined();
  });

  it("steps over cards hidden by the filter", () => {
    const filtered = boardWith([card("A"), card("B", []), card("C")]);
    const step = resolveCardStep(filtered, "A.md", "down", visibleOnly);
    expect(step).toEqual({
      from: { columnId: "todo", index: 0 },
      to: { columnId: "todo", index: 3 },
    });
    expect(stepAndApply(filtered, "A.md", "down", visibleOnly)).toEqual([
      "B",
      "C",
      "A",
    ]);
    expect(stepAndApply(filtered, "C.md", "up", visibleOnly)).toEqual([
      "C",
      "A",
      "B",
    ]);
  });

  it("stops at the last visible card even when hidden cards follow it", () => {
    const filtered = boardWith([card("A"), card("B"), card("C", [])]);
    expect(
      resolveCardStep(filtered, "B.md", "down", visibleOnly),
    ).toBeUndefined();
  });

  it("leaves a card hidden by the filter where it is", () => {
    const filtered = boardWith([card("A"), card("B", []), card("C")]);
    expect(
      resolveCardStep(filtered, "B.md", "up", visibleOnly),
    ).toBeUndefined();
    expect(
      resolveCardStep(board, "B.md", "up", {
        ...unfiltered,
        hiddenColumnIds: new Set(["todo"]),
      }),
    ).toBeUndefined();
  });

  it("ignores a path that is not on the board", () => {
    expect(
      resolveCardStep(board, "missing.md", "up", unfiltered),
    ).toBeUndefined();
  });

  it("locates the card by an equivalent path", () => {
    expect(stepAndApply(board, "./C.md", "up")).toEqual(["A", "C", "B"]);
  });
});
