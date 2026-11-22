import { describe, expect, it } from "vite-plus/test";
import type { Board } from "../../domain/board.ts";
import type { Card } from "../../domain/card.ts";
import { describeCardMenuMove } from "./cardMenuMove.ts";

function card(name: string, labels: string[] = []): Card {
  return {
    path: name + ".md",
    displayTitle: name,
    fileState: "available",
    labels,
  };
}

const moved = card("Draft", ["visible"]);
const board: Board = {
  version: 1,
  name: "Test",
  labels: [],
  columns: [
    {
      id: "todo",
      name: "To do",
      cards: [
        card("Previous", ["visible"]),
        card("Hidden"),
        card("Next", ["visible"]),
      ],
    },
    { id: "done", name: "Done", cards: [card("Another card"), moved] },
  ],
};
const criteria = {
  labels: new Set(["visible"]),
  hiddenColumnIds: new Set(["done"]),
};

describe("describeCardMenuMove", () => {
  it("announces the stored position and offers the next visible card as a focus fallback", () => {
    expect(
      describeCardMenuMove(
        board,
        moved.path,
        { columnId: "todo", index: 1 },
        criteria,
      ),
    ).toEqual({
      cardPath: "Draft.md",
      sourceColumnId: "todo",
      fallbackCardPath: "Next.md",
      message: "Moved Draft to Done, position 2 of 2.",
    });
  });

  it("falls back to the last visible card when the original slot was at the end", () => {
    const move = describeCardMenuMove(
      board,
      moved.path,
      { columnId: "todo", index: 3 },
      criteria,
    );
    expect(move?.fallbackCardPath).toBe("Next.md");
  });

  it("leaves no card fallback when the source column has no visible cards", () => {
    const move = describeCardMenuMove(
      board,
      moved.path,
      { columnId: "todo", index: 1 },
      {
        ...criteria,
        labels: new Set(["unmatched"]),
      },
    );
    expect(move?.sourceColumnId).toBe("todo");
    expect(move?.fallbackCardPath).toBeUndefined();
  });

  it("omits feedback when the moved card is missing", () => {
    const from = { columnId: "todo", index: 1 };
    expect(
      describeCardMenuMove(board, "missing.md", from, criteria),
    ).toBeUndefined();
  });
});
