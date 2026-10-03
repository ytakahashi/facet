import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Board } from "../../domain/board.ts";
import type { Card } from "../../domain/card.ts";
import { CardBoardPosition } from "./CardBoardPosition.tsx";

function card(path: string): Card {
  return { path, fileState: "available", labels: [], displayTitle: path };
}

const board: Board = {
  version: 1,
  name: "Test",
  labels: [],
  columns: [
    { id: "todo", name: "To do", cards: [card("a.md"), card("b.md")] },
    { id: "doing", name: "Doing", cards: [card("c.md")] },
  ],
};

function markup(currentBoard: Board, cardPath: string): string {
  return renderToStaticMarkup(
    <CardBoardPosition board={currentBoard} cardPath={cardPath} />,
  );
}

function visibleText(currentBoard: Board, cardPath: string): string {
  return markup(currentBoard, cardPath).replace(/<[^>]*>/g, "");
}

describe("CardBoardPosition", () => {
  it("shows the selected card's stored position and column name", () => {
    const output = visibleText(board, "a.md");

    expect(output).toContain("Column:");
    expect(output).toContain("To do");
    expect(output).toContain("1 of 2");
  });

  it("reflects a column rename and card move in the current board", () => {
    const changedBoard: Board = {
      ...board,
      columns: [
        { id: "todo", name: "To do", cards: [card("a.md")] },
        {
          id: "doing",
          name: "In progress",
          cards: [card("c.md"), card("b.md"), card("d.md")],
        },
      ],
    };

    const output = visibleText(changedBoard, "b.md");
    expect(output).toContain("In progress");
    expect(output).toContain("2 of 3");
  });

  it("finds the same card through case and Unicode-equivalent path spelling", () => {
    const equivalentBoard: Board = {
      ...board,
      columns: [{
        id: "todo",
        name: "To do",
        cards: [card("first.md"), card("Notes/caf\u00e9.md")],
      }],
    };

    const output = visibleText(equivalentBoard, "notes/./cafe\u0301.md");
    expect(output).toContain("To do");
    expect(output).toContain("2 of 2");
  });

  it("renders nothing when the selected card is absent from the board", () => {
    expect(markup(board, "absent.md")).toBe("");
  });
});
