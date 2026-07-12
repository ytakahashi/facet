import { describe, expect, it } from "vitest";
import type { Board } from "../../domain/board.ts";
import { createBoardStore } from "./boardStore.ts";

describe("createBoardStore", () => {
  it("moves to loaded with the board once openBoard resolves", async () => {
    const board: Board = { version: 1, name: "Development", columns: [] };
    const useBoardStore = createBoardStore(() => Promise.resolve(board));

    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    expect(useBoardStore.getState().status).toBe("loaded");
    expect(useBoardStore.getState().board).toEqual(board);
  });

  it("moves to error with the failure message when openBoard rejects", async () => {
    const useBoardStore = createBoardStore(() =>
      Promise.reject(new Error("board file not found"))
    );

    await useBoardStore.getState().openBoard("/board/missing.board.yaml");

    expect(useBoardStore.getState().status).toBe("error");
    expect(useBoardStore.getState().error).toBe("board file not found");
  });
});
