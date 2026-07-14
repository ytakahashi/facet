import { describe, expect, it, vi } from "vitest";
import type { Board } from "../../domain/board.ts";
import { createBoardStore } from "./boardStore.ts";

function makeBoard(): Board {
  return {
    version: 1,
    name: "Development",
    columns: [
      {
        id: "doing",
        name: "Doing",
        cards: [{ path: "a.md", labels: [], displayTitle: "A" }],
      },
      { id: "done", name: "Done", cards: [] },
    ],
  };
}

describe("createBoardStore", () => {
  it("moves to loaded with the board once openBoard resolves", async () => {
    const board = makeBoard();
    const useBoardStore = createBoardStore(
      () => Promise.resolve(board),
      vi.fn(),
    );

    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    expect(useBoardStore.getState().status).toBe("loaded");
    expect(useBoardStore.getState().board).toEqual(board);
  });

  it("moves to error with the failure message when openBoard rejects", async () => {
    const useBoardStore = createBoardStore(
      () => Promise.reject(new Error("board file not found")),
      vi.fn(),
    );

    await useBoardStore.getState().openBoard("/board/missing.board.yaml");

    expect(useBoardStore.getState().status).toBe("error");
    expect(useBoardStore.getState().error).toBe("board file not found");
  });

  it("updates the board immediately, before the save resolves", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn(() => new Promise<void>(() => {}));
    const useBoardStore = createBoardStore(
      () => Promise.resolve(board),
      saveBoard,
    );
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().moveCard(
      { columnId: "doing", index: 0 },
      { columnId: "done", index: 0 },
    );

    expect(useBoardStore.getState().board?.columns[0].cards).toEqual([]);
    expect(useBoardStore.getState().board?.columns[1].cards).toEqual([
      { path: "a.md", labels: [], displayTitle: "A" },
    ]);
  });

  it("saves the moved board at the board's path", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn().mockResolvedValue(undefined);
    const useBoardStore = createBoardStore(
      () => Promise.resolve(board),
      saveBoard,
    );
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().moveCard(
      { columnId: "doing", index: 0 },
      { columnId: "done", index: 0 },
    );
    await vi.waitFor(() =>
      expect(useBoardStore.getState().isSaving).toBe(false)
    );

    expect(saveBoard).toHaveBeenCalledWith(
      "/board/development.board.yaml",
      useBoardStore.getState().board,
    );
  });

  it("keeps the optimistic board and reports an error when saving fails", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn().mockRejectedValue(new Error("disk full"));
    const useBoardStore = createBoardStore(
      () => Promise.resolve(board),
      saveBoard,
    );
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().moveCard(
      { columnId: "doing", index: 0 },
      { columnId: "done", index: 0 },
    );
    await vi.waitFor(() =>
      expect(useBoardStore.getState().saveError).toBe("disk full")
    );

    expect(useBoardStore.getState().board?.columns[1].cards).toEqual([
      { path: "a.md", labels: [], displayTitle: "A" },
    ]);
  });

  it("retries the save when retrySave is called", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn()
      .mockRejectedValueOnce(new Error("disk full"))
      .mockResolvedValue(undefined);
    const useBoardStore = createBoardStore(
      () => Promise.resolve(board),
      saveBoard,
    );
    await useBoardStore.getState().openBoard("/board/development.board.yaml");
    useBoardStore.getState().moveCard(
      { columnId: "doing", index: 0 },
      { columnId: "done", index: 0 },
    );
    await vi.waitFor(() =>
      expect(useBoardStore.getState().saveError).toBe("disk full")
    );

    useBoardStore.getState().retrySave();
    await vi.waitFor(() =>
      expect(useBoardStore.getState().saveError).toBeUndefined()
    );

    expect(saveBoard).toHaveBeenCalledTimes(2);
  });
});
