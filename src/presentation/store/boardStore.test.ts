import { describe, expect, it, vi } from "vitest";
import type { Board } from "../../domain/board.ts";
import type { Card } from "../../domain/card.ts";
import { UseCaseError } from "../../usecase/useCaseError.ts";
import { toUiError } from "../errors/toUiError.ts";
import type { BoardStoreDeps } from "./boardStore.ts";
import { createBoardStore } from "./boardStore.ts";

// Every dependency is required by the store, but a given test only cares about
// one or two of them. Spelling out only those keeps each test's setup about
// what it actually exercises.
function makeDeps(overrides: Partial<BoardStoreDeps> = {}): BoardStoreDeps {
  return {
    openBoard: vi.fn(),
    saveBoard: vi.fn().mockResolvedValue("revision-next"),
    createMarkdownCard: vi.fn(),
    addExistingMarkdownCard: vi.fn(),
    relocateMarkdownCard: vi.fn(),
    recreateMarkdownCard: vi.fn(),
    renameMarkdownCard: vi.fn(),
    createBoard: vi.fn(),
    deleteMarkdown: vi.fn(),
    confirmDiscardBoard: vi.fn(() => true),
    confirmOverwriteBoard: vi.fn(() => true),
    ...overrides,
  };
}

function makeBoard(overrides: Partial<Board> = {}): Board {
  return {
    version: 1,
    name: "Development",
    labels: [],
    columns: [
      {
        id: "doing",
        name: "Doing",
        cards: [{
          path: "a.md",
          fileState: "available",
          labels: [],
          displayTitle: "A",
        }],
      },
      { id: "done", name: "Done", cards: [] },
    ],
    ...overrides,
  };
}

function loaded(board: Board, revision = "revision-1") {
  return { board, revision };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe("createBoardStore", () => {
  it("moves to loaded with the board once openBoard resolves", async () => {
    const board = makeBoard();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
    }));

    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    expect(useBoardStore.getState().status).toBe("loaded");
    expect(useBoardStore.getState().board).toEqual(board);
  });

  it("moves to error with the toUiError message when openBoard rejects", async () => {
    const openBoardError = new UseCaseError("board.open-failed", {
      path: "/board/missing.board.yaml",
    });
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.reject(openBoardError),
    }));

    await useBoardStore.getState().openBoard("/board/missing.board.yaml");

    expect(useBoardStore.getState().status).toBe("error");
    expect(useBoardStore.getState().error).toBe(
      toUiError(openBoardError).message,
    );
  });

  it("creates a board and opens it from the created path", async () => {
    const board = makeBoard();
    const openBoard = vi.fn().mockResolvedValue(loaded(board));
    const createBoard = vi.fn().mockResolvedValue(
      "/boards/facet.board.yaml",
    );
    const useBoardStore = createBoardStore(makeDeps({
      openBoard,
      createBoard,
    }));

    const path = await useBoardStore.getState().createBoard({
      directory: "/boards",
      fileName: "facet.board.yaml",
      name: "My Board",
    });

    expect(createBoard).toHaveBeenCalledWith({
      directory: "/boards",
      fileName: "facet.board.yaml",
      name: "My Board",
    });
    expect(openBoard).toHaveBeenCalledWith("/boards/facet.board.yaml");
    expect(path).toBe("/boards/facet.board.yaml");
    expect(useBoardStore.getState().status).toBe("loaded");
    expect(useBoardStore.getState().path).toBe("/boards/facet.board.yaml");
  });

  it("propagates a creation failure without opening a board", async () => {
    const openBoard = vi.fn();
    const createBoard = vi.fn().mockRejectedValue(
      new UseCaseError("board.file-already-exists", {
        path: "/boards/facet.board.yaml",
      }),
    );
    const useBoardStore = createBoardStore(makeDeps({
      openBoard,
      createBoard,
    }));

    const act = () =>
      useBoardStore.getState().createBoard({
        directory: "/boards",
        fileName: "facet.board.yaml",
        name: "My Board",
      });

    await expect(act).rejects.toMatchObject({
      code: "board.file-already-exists",
    });
    expect(openBoard).not.toHaveBeenCalled();
    expect(useBoardStore.getState().status).toBe("empty");
  });

  it("returns the created path when reading the new board fails", async () => {
    const useBoardStore = createBoardStore(makeDeps({
      createBoard: () => Promise.resolve("/boards/facet.board.yaml"),
      openBoard: () => Promise.reject(new UseCaseError("board.open-failed")),
    }));

    const path = await useBoardStore.getState().createBoard({
      directory: "/boards",
      fileName: "facet.board.yaml",
      name: "My Board",
    });

    expect(path).toBe("/boards/facet.board.yaml");
    expect(useBoardStore.getState().status).toBe("error");
  });

  it("updates the board immediately, before the save resolves", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn(() => new Promise<string>(() => {}));
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().moveCard(
      { columnId: "doing", index: 0 },
      { columnId: "done", index: 0 },
    );

    expect(useBoardStore.getState().board?.columns[0].cards).toEqual([]);
    expect(useBoardStore.getState().board?.columns[1].cards).toEqual([
      { path: "a.md", fileState: "available", labels: [], displayTitle: "A" },
    ]);
  });

  it("saves the moved board at the board's path", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn().mockResolvedValue("revision-2");
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
    }));
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
      "revision-1",
    );
  });

  it("keeps the optimistic board and reports an error when saving fails", async () => {
    const board = makeBoard();
    const saveFailedError = new UseCaseError("board.save-failed", {
      path: "/board/development.board.yaml",
    });
    const saveBoard = vi.fn().mockRejectedValue(saveFailedError);
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().moveCard(
      { columnId: "doing", index: 0 },
      { columnId: "done", index: 0 },
    );
    await vi.waitFor(() =>
      expect(useBoardStore.getState().saveError).toBe(
        toUiError(saveFailedError).message,
      )
    );

    expect(useBoardStore.getState().board?.columns[1].cards).toEqual([
      { path: "a.md", fileState: "available", labels: [], displayTitle: "A" },
    ]);
  });

  it("retries the save when retrySave is called", async () => {
    const board = makeBoard();
    const saveFailedError = new UseCaseError("board.save-failed", {
      path: "/board/development.board.yaml",
    });
    const saveBoard = vi.fn()
      .mockRejectedValueOnce(saveFailedError)
      .mockResolvedValue("revision-2");
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");
    useBoardStore.getState().moveCard(
      { columnId: "doing", index: 0 },
      { columnId: "done", index: 0 },
    );
    await vi.waitFor(() =>
      expect(useBoardStore.getState().saveError).toBe(
        toUiError(saveFailedError).message,
      )
    );

    useBoardStore.getState().retrySave();
    await vi.waitFor(() =>
      expect(useBoardStore.getState().saveError).toBeUndefined()
    );

    expect(saveBoard).toHaveBeenCalledTimes(2);
  });

  it("reorders the columns and saves the board", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn().mockResolvedValue("revision-2");
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().moveColumn("doing", 2);
    await vi.waitFor(() => expect(saveBoard).toHaveBeenCalled());

    expect(
      useBoardStore.getState().board?.columns.map((column) => column.id),
    ).toEqual(["done", "doing"]);
    expect(saveBoard).toHaveBeenCalledWith(
      "/board/development.board.yaml",
      useBoardStore.getState().board,
      "revision-1",
    );
  });

  it("does not save when a column is dropped back into its own slot", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn().mockResolvedValue("revision-2");
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().moveColumn("doing", 1);

    expect(useBoardStore.getState().board).toBe(board);
    expect(saveBoard).not.toHaveBeenCalled();
  });

  it("ignores a move of a column that is not on the board", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn().mockResolvedValue("revision-2");
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().moveColumn("missing", 0);

    expect(useBoardStore.getState().board).toBe(board);
    expect(saveBoard).not.toHaveBeenCalled();
  });

  it("appends a new column with the trimmed name at the right end and saves the board", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn().mockResolvedValue("revision-2");
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().addColumn("  Review  ");
    await vi.waitFor(() => expect(saveBoard).toHaveBeenCalled());

    const columns = useBoardStore.getState().board?.columns ?? [];
    expect(columns.map((column) => column.name)).toEqual([
      "Doing",
      "Done",
      "Review",
    ]);
    expect(columns[2].cards).toEqual([]);
    expect(saveBoard).toHaveBeenCalledWith(
      "/board/development.board.yaml",
      useBoardStore.getState().board,
      "revision-1",
    );
  });

  it("assigns each added column a unique non-empty id", async () => {
    const board = makeBoard();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard: vi.fn().mockResolvedValue("revision-2"),
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().addColumn("Review");
    useBoardStore.getState().addColumn("Review");

    const ids = (useBoardStore.getState().board?.columns ?? []).map(
      (column) => column.id,
    );
    expect(ids).toHaveLength(4);
    expect(ids.every((id) => id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("does not change or save the board for a whitespace-only column name", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().addColumn("   ");

    expect(useBoardStore.getState().board).toEqual(board);
    expect(saveBoard).not.toHaveBeenCalled();
  });

  it("keeps the added column and reports an error when saving fails", async () => {
    const board = makeBoard();
    const saveFailedError = new UseCaseError("board.save-failed", {
      path: "/board/development.board.yaml",
    });
    const saveBoard = vi.fn().mockRejectedValue(saveFailedError);
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().addColumn("Review");
    await vi.waitFor(() =>
      expect(useBoardStore.getState().saveError).toBe(
        toUiError(saveFailedError).message,
      )
    );

    const columns = useBoardStore.getState().board?.columns ?? [];
    expect(columns.map((column) => column.name)).toEqual([
      "Doing",
      "Done",
      "Review",
    ]);
  });

  it("renames the board with the trimmed name and saves it", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn().mockResolvedValue("revision-2");
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().renameBoard("  Renamed Board  ");
    await vi.waitFor(() => expect(saveBoard).toHaveBeenCalled());

    expect(useBoardStore.getState().board?.name).toBe("Renamed Board");
    expect(saveBoard).toHaveBeenCalledWith(
      "/board/development.board.yaml",
      useBoardStore.getState().board,
      "revision-1",
    );
  });

  it("does not change or save the board when the renamed board name is unchanged or blank", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().renameBoard("  Development  ");
    useBoardStore.getState().renameBoard("   ");

    expect(useBoardStore.getState().board).toEqual(board);
    expect(saveBoard).not.toHaveBeenCalled();
  });

  it("renames a column with the trimmed name and saves the board", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn().mockResolvedValue("revision-2");
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().renameColumn("doing", "  In Progress  ");
    await vi.waitFor(() => expect(saveBoard).toHaveBeenCalled());

    const columns = useBoardStore.getState().board?.columns ?? [];
    expect(columns.map((column) => column.name)).toEqual([
      "In Progress",
      "Done",
    ]);
    expect(columns[0].id).toBe("doing");
    expect(saveBoard).toHaveBeenCalledWith(
      "/board/development.board.yaml",
      useBoardStore.getState().board,
      "revision-1",
    );
  });

  it("does not change or save the board when the renamed name is unchanged or blank", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().renameColumn("doing", "  Doing  ");
    useBoardStore.getState().renameColumn("doing", "   ");

    expect(useBoardStore.getState().board).toEqual(board);
    expect(saveBoard).not.toHaveBeenCalled();
  });

  it("removes an empty column and saves the board", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn().mockResolvedValue("revision-2");
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().removeColumn("done");
    await vi.waitFor(() => expect(saveBoard).toHaveBeenCalled());

    const columns = useBoardStore.getState().board?.columns ?? [];
    expect(columns.map((column) => column.id)).toEqual(["doing"]);
    expect(saveBoard).toHaveBeenCalledWith(
      "/board/development.board.yaml",
      useBoardStore.getState().board,
      "revision-1",
    );
  });

  it("does not change or save the board when removing a column that holds cards", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().removeColumn("doing");

    expect(useBoardStore.getState().board).toEqual(board);
    expect(saveBoard).not.toHaveBeenCalled();
  });

  it("renames a card with the trimmed title and saves the board", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn().mockResolvedValue("revision-2");
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().renameCard("a.md", "  New Title  ");
    await vi.waitFor(() => expect(saveBoard).toHaveBeenCalled());

    const card = useBoardStore.getState().board?.columns[0].cards[0];
    expect(card?.titleOverride).toBe("New Title");
    expect(card?.displayTitle).toBe("New Title");
    expect(saveBoard).toHaveBeenCalledWith(
      "/board/development.board.yaml",
      useBoardStore.getState().board,
      "revision-1",
    );
  });

  it("does not change or save the board when the renamed title is unchanged or blank", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().renameCard("a.md", "  A  ");
    useBoardStore.getState().renameCard("a.md", "   ");

    expect(useBoardStore.getState().board).toEqual(board);
    expect(saveBoard).not.toHaveBeenCalled();
  });

  it("does not change or save the board when renaming an unknown card path", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().renameCard("missing.md", "New Title");

    expect(useBoardStore.getState().board).toEqual(board);
    expect(saveBoard).not.toHaveBeenCalled();
  });

  it("sets a card's priority and saves the board", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn().mockResolvedValue("revision-2");
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().setCardPriority("a.md", "high");
    await vi.waitFor(() => expect(saveBoard).toHaveBeenCalled());

    const card = useBoardStore.getState().board?.columns[0].cards[0];
    expect(card?.priority).toBe("high");
    expect(saveBoard).toHaveBeenCalledWith(
      "/board/development.board.yaml",
      useBoardStore.getState().board,
      "revision-1",
    );
  });

  it("clears a card's priority when set to undefined", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn().mockResolvedValue("revision-2");
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");
    useBoardStore.getState().setCardPriority("a.md", "high");
    await vi.waitFor(() => expect(saveBoard).toHaveBeenCalled());

    useBoardStore.getState().setCardPriority("a.md", undefined);
    await vi.waitFor(() => expect(saveBoard).toHaveBeenCalledTimes(2));

    const card = useBoardStore.getState().board?.columns[0].cards[0];
    expect(card?.priority).toBeUndefined();
    expect(saveBoard).toHaveBeenLastCalledWith(
      "/board/development.board.yaml",
      useBoardStore.getState().board,
      "revision-2",
    );
  });

  it("does not change or save the board when the priority is unchanged", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().setCardPriority("a.md", undefined);

    expect(useBoardStore.getState().board).toEqual(board);
    expect(saveBoard).not.toHaveBeenCalled();
  });

  it("does not change or save the board when setting priority on an unknown card", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().setCardPriority("missing.md", "high");

    expect(useBoardStore.getState().board).toEqual(board);
    expect(saveBoard).not.toHaveBeenCalled();
  });

  it("creates a label and saves the board", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn().mockResolvedValue("revision-2");
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().createLabel("  ui  ", "ruby");
    await vi.waitFor(() => expect(saveBoard).toHaveBeenCalled());

    expect(useBoardStore.getState().board?.labels).toEqual([
      { name: "ui", color: "ruby" },
    ]);
    expect(saveBoard).toHaveBeenCalledWith(
      "/board/development.board.yaml",
      useBoardStore.getState().board,
      "revision-1",
    );
  });

  it("does not change or save the board for a blank label name", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().createLabel("   ", "ruby");

    expect(useBoardStore.getState().board).toEqual(board);
    expect(saveBoard).not.toHaveBeenCalled();
  });

  it("throws a UseCaseError for a duplicate label name without changing or saving the board", async () => {
    const board = makeBoard({ labels: [{ name: "ui", color: "ruby" }] });
    const saveBoard = vi.fn();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    const act = () => useBoardStore.getState().createLabel("ui", "amber");

    expect(act).toThrow(UseCaseError);
    expect(act).toThrow(
      expect.objectContaining({ code: "label.already-exists" }),
    );
    expect(useBoardStore.getState().board).toEqual(board);
    expect(saveBoard).not.toHaveBeenCalled();
  });

  it("renames a label, updating tagged cards, and saves the board", async () => {
    const board = makeBoard({
      labels: [{ name: "ui", color: "ruby" }],
    });
    const saveBoard = vi.fn().mockResolvedValue("revision-2");
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");
    useBoardStore.getState().addCardLabel("a.md", "ui");
    await vi.waitFor(() => expect(saveBoard).toHaveBeenCalledTimes(1));

    useBoardStore.getState().renameLabel("ui", "interface");
    await vi.waitFor(() => expect(saveBoard).toHaveBeenCalledTimes(2));

    expect(useBoardStore.getState().board?.labels).toEqual([
      { name: "interface", color: "ruby" },
    ]);
    expect(useBoardStore.getState().board?.columns[0].cards[0].labels).toEqual(
      ["interface"],
    );
  });

  it("does not change or save the board when the renamed name is unchanged or blank", async () => {
    const board = makeBoard({ labels: [{ name: "ui", color: "ruby" }] });
    const saveBoard = vi.fn();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().renameLabel("ui", "  ui  ");
    useBoardStore.getState().renameLabel("ui", "   ");

    expect(useBoardStore.getState().board).toEqual(board);
    expect(saveBoard).not.toHaveBeenCalled();
  });

  it("throws a UseCaseError when renaming a label to an existing name", async () => {
    const board = makeBoard({
      labels: [{ name: "ui", color: "ruby" }, { name: "docs", color: "amber" }],
    });
    const saveBoard = vi.fn();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    const act = () => useBoardStore.getState().renameLabel("ui", "docs");

    expect(act).toThrow(
      expect.objectContaining({ code: "label.already-exists" }),
    );
    expect(useBoardStore.getState().board).toEqual(board);
    expect(saveBoard).not.toHaveBeenCalled();
  });

  it("changes a label's color and saves the board", async () => {
    const board = makeBoard({ labels: [{ name: "ui", color: "ruby" }] });
    const saveBoard = vi.fn().mockResolvedValue("revision-2");
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().setLabelColor("ui", "sapphire");
    await vi.waitFor(() => expect(saveBoard).toHaveBeenCalled());

    expect(useBoardStore.getState().board?.labels).toEqual([
      { name: "ui", color: "sapphire" },
    ]);
  });

  it("does not change or save the board when the label color is unchanged", async () => {
    const board = makeBoard({ labels: [{ name: "ui", color: "ruby" }] });
    const saveBoard = vi.fn();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().setLabelColor("ui", "ruby");

    expect(useBoardStore.getState().board).toEqual(board);
    expect(saveBoard).not.toHaveBeenCalled();
  });

  it("removes a label, untagging cards that had it, and saves the board", async () => {
    const board = makeBoard({
      labels: [{ name: "ui", color: "ruby" }],
    });
    const saveBoard = vi.fn().mockResolvedValue("revision-2");
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");
    useBoardStore.getState().addCardLabel("a.md", "ui");
    await vi.waitFor(() => expect(saveBoard).toHaveBeenCalledTimes(1));

    useBoardStore.getState().removeLabel("ui");
    await vi.waitFor(() => expect(saveBoard).toHaveBeenCalledTimes(2));

    expect(useBoardStore.getState().board?.labels).toEqual([]);
    expect(useBoardStore.getState().board?.columns[0].cards[0].labels).toEqual(
      [],
    );
  });

  it("queues label reordering but skips unchanged and stale moves", async () => {
    const board = makeBoard({
      labels: [
        { name: "first", color: "ruby" },
        { name: "last", color: "amber" },
      ],
    });
    const saveBoard = vi.fn().mockResolvedValue("revision-next");
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/labels.board.yaml");

    useBoardStore.getState().moveLabel("missing", 0);
    useBoardStore.getState().moveLabel("first", 0);
    expect(saveBoard).not.toHaveBeenCalled();

    useBoardStore.getState().moveLabel("first", 2);
    expect(useBoardStore.getState().board?.labels.map((label) => label.name))
      .toEqual(["last", "first"]);
    expect(saveBoard).toHaveBeenCalledTimes(1);
  });

  it("adds a label to a card and saves the board", async () => {
    const board = makeBoard({ labels: [{ name: "ui", color: "ruby" }] });
    const saveBoard = vi.fn().mockResolvedValue("revision-2");
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().addCardLabel("a.md", "ui");
    await vi.waitFor(() => expect(saveBoard).toHaveBeenCalled());

    expect(useBoardStore.getState().board?.columns[0].cards[0].labels).toEqual(
      ["ui"],
    );
    expect(saveBoard).toHaveBeenCalledWith(
      "/board/development.board.yaml",
      useBoardStore.getState().board,
      "revision-1",
    );
  });

  it("does not change or save the board when adding a label already on the card", async () => {
    const board = makeBoard({ labels: [{ name: "ui", color: "ruby" }] });
    const saveBoard = vi.fn().mockResolvedValue("revision-2");
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");
    useBoardStore.getState().addCardLabel("a.md", "ui");
    await vi.waitFor(() => expect(saveBoard).toHaveBeenCalledTimes(1));

    useBoardStore.getState().addCardLabel("a.md", "ui");

    expect(saveBoard).toHaveBeenCalledTimes(1);
  });

  it("does not change or save the board when adding an unknown label or to an unknown card", async () => {
    const board = makeBoard({ labels: [{ name: "ui", color: "ruby" }] });
    const saveBoard = vi.fn();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().addCardLabel("a.md", "missing");
    useBoardStore.getState().addCardLabel("missing.md", "ui");

    expect(useBoardStore.getState().board).toEqual(board);
    expect(saveBoard).not.toHaveBeenCalled();
  });

  it("removes a label from a card and saves the board", async () => {
    const board = makeBoard({ labels: [{ name: "ui", color: "ruby" }] });
    const saveBoard = vi.fn().mockResolvedValue("revision-2");
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");
    useBoardStore.getState().addCardLabel("a.md", "ui");
    await vi.waitFor(() => expect(saveBoard).toHaveBeenCalledTimes(1));

    useBoardStore.getState().removeCardLabel("a.md", "ui");
    await vi.waitFor(() => expect(saveBoard).toHaveBeenCalledTimes(2));

    expect(useBoardStore.getState().board?.columns[0].cards[0].labels).toEqual(
      [],
    );
  });

  it("does not change or save the board when removing a label not on the card", async () => {
    const board = makeBoard({ labels: [{ name: "ui", color: "ruby" }] });
    const saveBoard = vi.fn();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().removeCardLabel("a.md", "ui");

    expect(useBoardStore.getState().board).toEqual(board);
    expect(saveBoard).not.toHaveBeenCalled();
  });

  it("creates a Markdown card, appends it, and saves the updated board", async () => {
    const board = makeBoard();
    const card = {
      path: "new-card.md",
      absolutePath: "/board/new-card.md",
      fileState: "available",
      labels: [],
      displayTitle: "New card",
    };
    const saveBoard = vi.fn().mockResolvedValue("revision-2");
    const createMarkdownCard = vi.fn().mockResolvedValue(card);
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
      createMarkdownCard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    const result = await useBoardStore.getState().addNewCard({
      columnId: "doing",
      directory: "/board",
      fileName: "new-card",
      title: "New card",
    });
    await vi.waitFor(() => expect(saveBoard).toHaveBeenCalled());

    expect(result).toEqual(card);
    expect(createMarkdownCard).toHaveBeenCalledWith({
      boardPath: "/board/development.board.yaml",
      directory: "/board",
      fileName: "new-card",
      title: "New card",
    });
    expect(useBoardStore.getState().board?.columns[0].cards).toEqual([
      { path: "a.md", fileState: "available", labels: [], displayTitle: "A" },
      card,
    ]);
    expect(saveBoard).toHaveBeenCalledWith(
      "/board/development.board.yaml",
      useBoardStore.getState().board,
      "revision-1",
    );
  });

  it("rejects a duplicate path before creating the Markdown file", async () => {
    const board = makeBoard();
    const createMarkdownCard = vi.fn();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      createMarkdownCard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    const act = () =>
      useBoardStore.getState().addNewCard({
        columnId: "done",
        directory: "/board",
        fileName: "a.md",
        title: "A",
      });

    await expect(act).rejects.toMatchObject({ code: "card.already-on-board" });
    expect(createMarkdownCard).not.toHaveBeenCalled();
  });

  it("does not change or save the board when Markdown creation fails", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn();
    const createMarkdownCard = vi.fn().mockRejectedValue(
      new UseCaseError("card.file-already-exists", {
        path: "/board/new.md",
      }),
    );
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
      createMarkdownCard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    const act = () =>
      useBoardStore.getState().addNewCard({
        columnId: "done",
        directory: "/board",
        fileName: "new.md",
        title: "New",
      });

    await expect(act).rejects.toMatchObject({
      code: "card.file-already-exists",
    });
    expect(useBoardStore.getState().board).toEqual(board);
    expect(saveBoard).not.toHaveBeenCalled();
  });

  it("loads an existing Markdown card, appends it, and saves the board", async () => {
    const board = makeBoard();
    const card = {
      path: "ideas/existing.md",
      absolutePath: "/board/ideas/existing.md",
      fileState: "available",
      labels: [],
      displayTitle: "Existing",
    };
    const saveBoard = vi.fn().mockResolvedValue("revision-2");
    const addExistingMarkdownCard = vi.fn().mockResolvedValue(card);
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
      addExistingMarkdownCard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    const result = await useBoardStore.getState().addExistingCard({
      columnId: "done",
      absolutePath: "/board/ideas/existing.md",
    });
    await vi.waitFor(() => expect(saveBoard).toHaveBeenCalled());

    expect(result).toEqual(card);
    expect(addExistingMarkdownCard).toHaveBeenCalledWith({
      boardPath: "/board/development.board.yaml",
      absolutePath: "/board/ideas/existing.md",
    });
    expect(useBoardStore.getState().board?.columns[1].cards).toEqual([card]);
  });

  it("rejects an existing duplicate before reading the Markdown file", async () => {
    const board = makeBoard();
    const addExistingMarkdownCard = vi.fn();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      addExistingMarkdownCard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    const act = () =>
      useBoardStore.getState().addExistingCard({
        columnId: "done",
        absolutePath: "/board/a.md",
      });

    await expect(act).rejects.toMatchObject({ code: "card.already-on-board" });
    expect(addExistingMarkdownCard).not.toHaveBeenCalled();
  });

  it("does not change or save the board when loading existing Markdown fails", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn();
    const addExistingMarkdownCard = vi.fn().mockRejectedValue(
      new UseCaseError("card.load-failed", {
        path: "/board/missing.md",
      }),
    );
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
      addExistingMarkdownCard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    const act = () =>
      useBoardStore.getState().addExistingCard({
        columnId: "done",
        absolutePath: "/board/missing.md",
      });

    await expect(act).rejects.toMatchObject({ code: "card.load-failed" });
    expect(useBoardStore.getState().board).toEqual(board);
    expect(saveBoard).not.toHaveBeenCalled();
  });

  it("rejects an existing card added while its Markdown is loading", async () => {
    const board = makeBoard();
    const card: Card = {
      path: "existing.md",
      absolutePath: "/board/existing.md",
      fileState: "available",
      labels: [],
      displayTitle: "Existing",
    };
    let finishLoading: (loadedCard: typeof card) => void = () => {};
    const loading = new Promise<typeof card>((resolve) => {
      finishLoading = resolve;
    });
    const saveBoard = vi.fn();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
      addExistingMarkdownCard: vi.fn().mockReturnValue(loading),
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    const adding = useBoardStore.getState().addExistingCard({
      columnId: "done",
      absolutePath: "/board/existing.md",
    });
    useBoardStore.setState({
      board: {
        ...board,
        columns: board.columns.map((column) =>
          column.id === "done"
            ? { ...column, cards: [...column.cards, card] }
            : column
        ),
      },
    });
    finishLoading(card);

    await expect(adding).rejects.toMatchObject({
      code: "card.already-on-board",
    });
    expect(saveBoard).not.toHaveBeenCalled();
  });

  it("keeps an existing card visible when saving it fails", async () => {
    const board = makeBoard();
    const card = {
      path: "existing.md",
      absolutePath: "/board/existing.md",
      fileState: "available",
      labels: [],
      displayTitle: "Existing",
    };
    const saveBoard = vi.fn().mockRejectedValue(
      new UseCaseError("board.save-failed", {
        path: "/board/development.board.yaml",
      }),
    );
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
      addExistingMarkdownCard: vi.fn().mockResolvedValue(card),
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    await useBoardStore.getState().addExistingCard({
      columnId: "done",
      absolutePath: "/board/existing.md",
    });
    await vi.waitFor(() =>
      expect(useBoardStore.getState().saveError).toBeDefined()
    );

    expect(useBoardStore.getState().board?.columns[1].cards).toEqual([card]);
  });

  it("drops the card reference without touching the file when the file is kept", async () => {
    const board = makeBoard();
    const deleteMarkdown = vi.fn();
    const saveBoard = vi.fn().mockResolvedValue("revision-2");
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
      deleteMarkdown,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    await useBoardStore.getState().removeCard("a.md", { deleteFile: false });
    await vi.waitFor(() =>
      expect(useBoardStore.getState().isSaving).toBe(false)
    );

    expect(deleteMarkdown).not.toHaveBeenCalled();
    expect(useBoardStore.getState().board?.columns[0].cards).toEqual([]);
    expect(saveBoard).toHaveBeenCalledWith(
      "/board/development.board.yaml",
      useBoardStore.getState().board,
      "revision-1",
    );
  });

  it("deletes the Markdown file before dropping the card reference", async () => {
    const board = makeBoard({
      columns: [
        {
          id: "doing",
          name: "Doing",
          cards: [{
            path: "a.md",
            absolutePath: "/board/a.md",
            fileState: "available",
            labels: [],
            displayTitle: "A",
          }],
        },
      ],
    });
    const calls: string[] = [];
    const deleteMarkdown = vi.fn(async (path: string) => {
      calls.push(`delete:${path}`);
    });
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard: vi.fn(async () => {
        calls.push("save");
        return "revision-2";
      }),
      deleteMarkdown,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    await useBoardStore.getState().removeCard("a.md", { deleteFile: true });
    await vi.waitFor(() => expect(calls).toContain("save"));

    expect(deleteMarkdown).toHaveBeenCalledWith("/board/a.md");
    expect(calls).toEqual(["delete:/board/a.md", "save"]);
    expect(useBoardStore.getState().board?.columns[0].cards).toEqual([]);
  });

  it("leaves the board untouched when deleting the Markdown file fails", async () => {
    const board = makeBoard({
      columns: [
        {
          id: "doing",
          name: "Doing",
          cards: [{
            path: "a.md",
            absolutePath: "/board/a.md",
            fileState: "available",
            labels: [],
            displayTitle: "A",
          }],
        },
      ],
    });
    const saveBoard = vi.fn();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
      deleteMarkdown: vi.fn().mockRejectedValue(
        new UseCaseError("markdown.delete-failed", { path: "/board/a.md" }),
      ),
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    const act = () =>
      useBoardStore.getState().removeCard("a.md", { deleteFile: true });

    await expect(act).rejects.toMatchObject({
      code: "markdown.delete-failed",
    });
    expect(useBoardStore.getState().board).toEqual(board);
    expect(saveBoard).not.toHaveBeenCalled();
  });

  it("reports a board change when another board is opened mid-delete", async () => {
    const board = makeBoard({
      columns: [
        {
          id: "doing",
          name: "Doing",
          cards: [{
            path: "a.md",
            absolutePath: "/board/a.md",
            fileState: "available",
            labels: [],
            displayTitle: "A",
          }],
        },
      ],
    });
    let finishDelete!: () => void;
    const deleting = new Promise<void>((resolve) => {
      finishDelete = resolve;
    });
    const saveBoard = vi.fn();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
      deleteMarkdown: vi.fn().mockReturnValue(deleting),
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    const removing = useBoardStore.getState().removeCard("a.md", {
      deleteFile: true,
    });
    useBoardStore.setState({ path: "/board/other.board.yaml" });
    finishDelete();

    await expect(removing).rejects.toMatchObject({
      code: "card.board-changed",
    });
    expect(saveBoard).not.toHaveBeenCalled();
  });

  it("does nothing for a path that is not on the board", async () => {
    const board = makeBoard();
    const deleteMarkdown = vi.fn();
    const saveBoard = vi.fn();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
      deleteMarkdown,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    await useBoardStore.getState().removeCard("missing.md", {
      deleteFile: true,
    });

    expect(deleteMarkdown).not.toHaveBeenCalled();
    expect(saveBoard).not.toHaveBeenCalled();
    expect(useBoardStore.getState().board).toEqual(board);
  });

  function makeBrokenBoard(): Board {
    return makeBoard({
      columns: [
        {
          id: "doing",
          name: "Doing",
          cards: [{
            path: "gone.md",
            absolutePath: "/board/gone.md",
            fileState: "missing",
            labels: [],
            displayTitle: "gone",
          }],
        },
        { id: "done", name: "Done", cards: [] },
      ],
    });
  }

  const repairedCard: Card = {
    path: "ideas/moved.md",
    absolutePath: "/board/ideas/moved.md",
    fileState: "available",
    labels: [],
    displayTitle: "Moved card",
  };

  it("replaces the repaired card in place and saves the board", async () => {
    const board = makeBrokenBoard();
    const relocateMarkdownCard = vi.fn().mockResolvedValue(repairedCard);
    const saveBoard = vi.fn().mockResolvedValue("revision-2");
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
      relocateMarkdownCard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    const result = await useBoardStore.getState().relocateCard(
      "gone.md",
      "/board/ideas/moved.md",
    );
    await vi.waitFor(() =>
      expect(useBoardStore.getState().isSaving).toBe(false)
    );

    expect(relocateMarkdownCard).toHaveBeenCalledWith({
      boardPath: "/board/development.board.yaml",
      card: board.columns[0].cards[0],
      absolutePath: "/board/ideas/moved.md",
    });
    expect(result).toBe(repairedCard);
    expect(useBoardStore.getState().board?.columns[0].cards).toEqual([
      repairedCard,
    ]);
    expect(saveBoard).toHaveBeenCalledWith(
      "/board/development.board.yaml",
      useBoardStore.getState().board,
      "revision-1",
    );
  });

  it("leaves the board untouched when the file cannot be read", async () => {
    const board = makeBrokenBoard();
    const saveBoard = vi.fn();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
      relocateMarkdownCard: vi.fn().mockRejectedValue(
        new UseCaseError("card.file-not-found", {
          path: "/board/ideas/moved.md",
        }),
      ),
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    const act = () =>
      useBoardStore.getState().relocateCard("gone.md", "/board/ideas/moved.md");

    await expect(act).rejects.toMatchObject({ code: "card.file-not-found" });
    expect(useBoardStore.getState().board).toEqual(board);
    expect(saveBoard).not.toHaveBeenCalled();
  });

  it("reports a repaired path that another card already holds", async () => {
    const board = makeBoard({
      columns: [
        {
          id: "doing",
          name: "Doing",
          cards: [{
            path: "gone.md",
            absolutePath: "/board/gone.md",
            fileState: "missing",
            labels: [],
            displayTitle: "gone",
          }],
        },
        { id: "done", name: "Done", cards: [repairedCard] },
      ],
    });
    const saveBoard = vi.fn();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
      relocateMarkdownCard: vi.fn().mockResolvedValue(repairedCard),
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    const act = () =>
      useBoardStore.getState().relocateCard("gone.md", "/board/ideas/moved.md");

    await expect(act).rejects.toMatchObject({
      code: "card.already-on-board",
      details: { path: "ideas/moved.md" },
    });
    expect(useBoardStore.getState().board).toEqual(board);
    expect(saveBoard).not.toHaveBeenCalled();
  });

  it("reports a board change when another board is opened mid-repair", async () => {
    const board = makeBrokenBoard();
    let finishRelocate: () => void = () => {};
    const relocating = new Promise<Card>((resolve) => {
      finishRelocate = () => resolve(repairedCard);
    });
    const saveBoard = vi.fn();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
      relocateMarkdownCard: vi.fn().mockReturnValue(relocating),
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    const repairing = useBoardStore.getState().relocateCard(
      "gone.md",
      "/board/ideas/moved.md",
    );
    useBoardStore.setState({ path: "/board/other.board.yaml" });
    finishRelocate();

    await expect(repairing).rejects.toMatchObject({
      code: "card.board-changed",
    });
    expect(saveBoard).not.toHaveBeenCalled();
  });

  it("writes the missing file and replaces the card with the created one", async () => {
    const board = makeBrokenBoard();
    const recreated: Card = {
      path: "gone.md",
      absolutePath: "/board/gone.md",
      fileState: "available",
      labels: [],
      displayTitle: "Back again",
    };
    const recreateMarkdownCard = vi.fn().mockResolvedValue(recreated);
    const saveBoard = vi.fn().mockResolvedValue("revision-2");
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
      recreateMarkdownCard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    const result = await useBoardStore.getState().recreateCard(
      "gone.md",
      "/board/gone.md",
      "Back again",
    );
    await vi.waitFor(() =>
      expect(useBoardStore.getState().isSaving).toBe(false)
    );

    expect(recreateMarkdownCard).toHaveBeenCalledWith({
      boardPath: "/board/development.board.yaml",
      card: board.columns[0].cards[0],
      absolutePath: "/board/gone.md",
      title: "Back again",
    });
    expect(result).toBe(recreated);
    expect(useBoardStore.getState().board?.columns[0].cards).toEqual([
      recreated,
    ]);
    expect(saveBoard).toHaveBeenCalledWith(
      "/board/development.board.yaml",
      useBoardStore.getState().board,
      "revision-1",
    );
  });

  it("refuses to write a file at a path another card already holds", async () => {
    const board = makeBoard({
      columns: [
        {
          id: "doing",
          name: "Doing",
          cards: [{
            path: "gone.md",
            absolutePath: "/board/gone.md",
            fileState: "missing",
            labels: [],
            displayTitle: "gone",
          }],
        },
        { id: "done", name: "Done", cards: [repairedCard] },
      ],
    });
    const recreateMarkdownCard = vi.fn();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      recreateMarkdownCard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    const act = () =>
      useBoardStore.getState().recreateCard(
        "gone.md",
        "/board/ideas/moved.md",
        "Back again",
      );

    await expect(act).rejects.toMatchObject({
      code: "card.already-on-board",
      details: { path: "ideas/moved.md" },
    });
    expect(recreateMarkdownCard).not.toHaveBeenCalled();
  });

  it("rejects a target outside the board directory before writing", async () => {
    const board = makeBrokenBoard();
    const recreateMarkdownCard = vi.fn();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      recreateMarkdownCard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    const act = () =>
      useBoardStore.getState().recreateCard(
        "gone.md",
        "/other/gone.md",
        "Back again",
      );

    await expect(act).rejects.toMatchObject({
      code: "card.outside-board-directory",
    });
    expect(recreateMarkdownCard).not.toHaveBeenCalled();
  });

  it("leaves the board untouched when the file cannot be written", async () => {
    const board = makeBrokenBoard();
    const saveBoard = vi.fn();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
      recreateMarkdownCard: vi.fn().mockRejectedValue(
        new UseCaseError("card.file-already-exists", {
          path: "/board/gone.md",
        }),
      ),
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    const act = () =>
      useBoardStore.getState().recreateCard(
        "gone.md",
        "/board/gone.md",
        "Back again",
      );

    await expect(act).rejects.toMatchObject({
      code: "card.file-already-exists",
    });
    expect(useBoardStore.getState().board).toEqual(board);
    expect(saveBoard).not.toHaveBeenCalled();
  });

  it("reports a board change for a path that is no longer on the board", async () => {
    const board = makeBrokenBoard();
    const relocateMarkdownCard = vi.fn();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      relocateMarkdownCard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    const act = () =>
      useBoardStore.getState().relocateCard(
        "unknown.md",
        "/board/ideas/moved.md",
      );

    await expect(act).rejects.toMatchObject({ code: "card.board-changed" });
    expect(relocateMarkdownCard).not.toHaveBeenCalled();
  });

  const movedCard: Card = {
    path: "ideas/search.md",
    absolutePath: "/board/ideas/search.md",
    fileState: "available",
    labels: [],
    displayTitle: "A",
  };

  it("replaces the moved card in place and saves the board", async () => {
    const board = makeBoard();
    const renameMarkdownCard = vi.fn().mockResolvedValue(movedCard);
    const saveBoard = vi.fn().mockResolvedValue("revision-2");
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
      renameMarkdownCard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    const result = await useBoardStore.getState().renameCardFile(
      "a.md",
      "/board/ideas",
      "search.md",
    );
    await vi.waitFor(() =>
      expect(useBoardStore.getState().isSaving).toBe(false)
    );

    expect(renameMarkdownCard).toHaveBeenCalledWith({
      boardPath: "/board/development.board.yaml",
      card: board.columns[0].cards[0],
      directory: "/board/ideas",
      fileName: "search.md",
    });
    expect(result).toBe(movedCard);
    // The column and the position within it are the board's, not the card's,
    // so moving the file must not disturb either.
    expect(useBoardStore.getState().board?.columns[0].cards).toEqual([
      movedCard,
    ]);
    expect(saveBoard).toHaveBeenCalledWith(
      "/board/development.board.yaml",
      useBoardStore.getState().board,
      "revision-1",
    );
  });

  it("does nothing for the path the card already has", async () => {
    const board = makeBoard();
    const renameMarkdownCard = vi.fn();
    const saveBoard = vi.fn();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
      renameMarkdownCard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    const result = await useBoardStore.getState().renameCardFile(
      "a.md",
      "/board",
      "a.md",
    );

    expect(result).toBe(board.columns[0].cards[0]);
    expect(renameMarkdownCard).not.toHaveBeenCalled();
    expect(saveBoard).not.toHaveBeenCalled();
  });

  it("treats a change of letter case as a rename rather than as no change", async () => {
    const board = makeBoard();
    const renameMarkdownCard = vi.fn().mockResolvedValue(movedCard);
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      renameMarkdownCard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    await useBoardStore.getState().renameCardFile("a.md", "/board", "A.md");

    expect(renameMarkdownCard).toHaveBeenCalledWith({
      boardPath: "/board/development.board.yaml",
      card: board.columns[0].cards[0],
      directory: "/board",
      fileName: "A.md",
    });
  });

  it("refuses a destination another card already holds, before the file moves", async () => {
    const board = makeBoard({
      columns: [
        {
          id: "doing",
          name: "Doing",
          cards: [{
            path: "a.md",
            absolutePath: "/board/a.md",
            fileState: "available",
            labels: [],
            displayTitle: "A",
          }],
        },
        { id: "done", name: "Done", cards: [movedCard] },
      ],
    });
    const renameMarkdownCard = vi.fn();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      renameMarkdownCard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    const act = () =>
      useBoardStore.getState().renameCardFile(
        "a.md",
        "/board/ideas",
        "search.md",
      );

    await expect(act).rejects.toMatchObject({
      code: "card.already-on-board",
      details: { path: "ideas/search.md" },
    });
    expect(renameMarkdownCard).not.toHaveBeenCalled();
  });

  it("refuses a destination a missing card holds in a different letter case", async () => {
    const board = makeBoard({
      columns: [
        {
          id: "doing",
          name: "Doing",
          cards: [{
            path: "a.md",
            absolutePath: "/board/a.md",
            fileState: "available",
            labels: [],
            displayTitle: "A",
          }],
        },
        {
          id: "done",
          name: "Done",
          // Its file is gone, so the file system cannot report the collision:
          // renaming onto it would leave two cards over one file.
          cards: [{
            path: "Test1.md",
            absolutePath: "/board/Test1.md",
            fileState: "missing",
            labels: [],
            displayTitle: "Test1",
          }],
        },
      ],
    });
    const renameMarkdownCard = vi.fn();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      renameMarkdownCard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    const act = () =>
      useBoardStore.getState().renameCardFile("a.md", "/board", "test1.md");

    await expect(act).rejects.toMatchObject({
      code: "card.already-on-board",
      details: { path: "test1.md" },
    });
    expect(renameMarkdownCard).not.toHaveBeenCalled();
  });

  it("rejects a destination outside the board directory before the file moves", async () => {
    const board = makeBoard();
    const renameMarkdownCard = vi.fn();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      renameMarkdownCard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    const act = () =>
      useBoardStore.getState().renameCardFile("a.md", "/other", "search.md");

    await expect(act).rejects.toMatchObject({
      code: "card.outside-board-directory",
    });
    expect(renameMarkdownCard).not.toHaveBeenCalled();
  });

  it("leaves the board untouched when the file cannot be moved", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      saveBoard,
      renameMarkdownCard: vi.fn().mockRejectedValue(
        new UseCaseError("card.file-already-exists", {
          path: "/board/ideas/search.md",
        }),
      ),
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    const act = () =>
      useBoardStore.getState().renameCardFile(
        "a.md",
        "/board/ideas",
        "search.md",
      );

    await expect(act).rejects.toMatchObject({
      code: "card.file-already-exists",
    });
    expect(useBoardStore.getState().board).toEqual(board);
    expect(saveBoard).not.toHaveBeenCalled();
  });

  it("reports a board change when another board is opened mid-move", async () => {
    const board = makeBoard();
    const otherBoard = makeBoard({ name: "Other" });
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: vi.fn()
        .mockResolvedValueOnce(loaded(board))
        .mockResolvedValueOnce(loaded(otherBoard, "other-revision")),
      renameMarkdownCard: async () => {
        // The native menu stays clickable while the modal dialog is open.
        await useBoardStore.getState().openBoard("/board/other.board.yaml");
        return movedCard;
      },
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    const act = () =>
      useBoardStore.getState().renameCardFile(
        "a.md",
        "/board/ideas",
        "search.md",
      );

    await expect(act).rejects.toMatchObject({ code: "card.board-changed" });
  });

  it("reports a board change for a path that is not on the board", async () => {
    const board = makeBoard();
    const renameMarkdownCard = vi.fn();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(board)),
      renameMarkdownCard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    const act = () =>
      useBoardStore.getState().renameCardFile(
        "unknown.md",
        "/board/ideas",
        "search.md",
      );

    await expect(act).rejects.toMatchObject({ code: "card.board-changed" });
    expect(renameMarkdownCard).not.toHaveBeenCalled();
  });

  it("uses the revision returned by an in-flight save for the coalesced save", async () => {
    const firstSave = deferred<string>();
    const saveBoard = vi.fn()
      .mockReturnValueOnce(firstSave.promise)
      .mockResolvedValueOnce("revision-3");
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(makeBoard())),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().renameBoard("First edit");
    useBoardStore.getState().renameBoard("Latest edit");
    expect(saveBoard).toHaveBeenCalledTimes(1);

    firstSave.resolve("revision-2");
    await vi.waitFor(() => expect(saveBoard).toHaveBeenCalledTimes(2));

    expect(saveBoard).toHaveBeenLastCalledWith(
      "/board/development.board.yaml",
      useBoardStore.getState().board,
      "revision-2",
    );
    await vi.waitFor(() =>
      expect(useBoardStore.getState().isSaving).toBe(false)
    );
  });

  it("keeps optimistic edits and stops later writes after a conflict", async () => {
    const conflict = new UseCaseError("board.conflict", {
      path: "/board/development.board.yaml",
    });
    const saveBoard = vi.fn().mockRejectedValue(conflict);
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(makeBoard())),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().renameBoard("Local edit");
    await vi.waitFor(() =>
      expect(useBoardStore.getState().saveConflict).toBe(true)
    );
    useBoardStore.getState().addColumn("Still local");

    expect(useBoardStore.getState().board?.name).toBe("Local edit");
    expect(useBoardStore.getState().board?.columns.at(-1)?.name).toBe(
      "Still local",
    );
    expect(useBoardStore.getState().saveError).toBe(
      toUiError(conflict).message,
    );
    expect(saveBoard).toHaveBeenCalledTimes(1);
  });

  it("reloads a conflicted board only after discard confirmation", async () => {
    const diskBoard = makeBoard({ name: "From disk" });
    const openBoard = vi.fn()
      .mockResolvedValueOnce(loaded(makeBoard()))
      .mockResolvedValueOnce(loaded(diskBoard, "revision-2"));
    const confirmDiscardBoard = vi.fn(() => true);
    const useBoardStore = createBoardStore(makeDeps({
      openBoard,
      saveBoard: vi.fn().mockRejectedValue(new UseCaseError("board.conflict")),
      confirmDiscardBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");
    useBoardStore.getState().renameBoard("Local edit");
    await vi.waitFor(() =>
      expect(useBoardStore.getState().saveConflict).toBe(true)
    );

    await useBoardStore.getState().reloadBoard();

    expect(confirmDiscardBoard).toHaveBeenCalledWith("reload");
    expect(useBoardStore.getState()).toMatchObject({
      board: diskBoard,
      saveConflict: false,
      saveError: undefined,
      conflictResolutionError: undefined,
    });
  });

  it("does not start another reload while conflict resolution is in progress", async () => {
    const reloading = deferred<ReturnType<typeof loaded>>();
    const openBoard = vi.fn()
      .mockResolvedValueOnce(loaded(makeBoard()))
      .mockReturnValueOnce(reloading.promise);
    const confirmDiscardBoard = vi.fn(() => true);
    const useBoardStore = createBoardStore(makeDeps({
      openBoard,
      saveBoard: vi.fn().mockRejectedValue(new UseCaseError("board.conflict")),
      confirmDiscardBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");
    useBoardStore.getState().renameBoard("Local edit");
    await vi.waitFor(() =>
      expect(useBoardStore.getState().saveConflict).toBe(true)
    );

    const firstReload = useBoardStore.getState().reloadBoard();
    const secondReload = useBoardStore.getState().reloadBoard();

    expect(useBoardStore.getState().conflictResolution).toBe("reloading");
    expect(confirmDiscardBoard).toHaveBeenCalledOnce();
    expect(openBoard).toHaveBeenCalledTimes(2);

    reloading.resolve(loaded(makeBoard({ name: "From disk" }), "revision-2"));
    await Promise.all([firstReload, secondReload]);
    expect(useBoardStore.getState().conflictResolution).toBeUndefined();
  });

  it("overwrites a conflicted board without an expected revision", async () => {
    const saveBoard = vi.fn()
      .mockRejectedValueOnce(new UseCaseError("board.conflict"))
      .mockResolvedValueOnce("revision-overwritten");
    const confirmOverwriteBoard = vi.fn(() => true);
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(makeBoard())),
      saveBoard,
      confirmOverwriteBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");
    useBoardStore.getState().renameBoard("Local edit");
    await vi.waitFor(() =>
      expect(useBoardStore.getState().saveConflict).toBe(true)
    );

    useBoardStore.getState().overwriteBoard();
    await vi.waitFor(() => expect(saveBoard).toHaveBeenCalledTimes(2));

    expect(confirmOverwriteBoard).toHaveBeenCalledOnce();
    expect(saveBoard).toHaveBeenLastCalledWith(
      "/board/development.board.yaml",
      useBoardStore.getState().board,
      undefined,
    );
    await vi.waitFor(() =>
      expect(useBoardStore.getState().isSaving).toBe(false)
    );
    expect(useBoardStore.getState().saveConflict).toBe(false);
  });

  it("keeps the conflict when overwrite fails", async () => {
    const conflictError = new UseCaseError("board.conflict");
    const overwriteError = new UseCaseError("board.save-failed", {
      path: "/board/development.board.yaml",
    });
    const saveBoard = vi.fn()
      .mockRejectedValueOnce(conflictError)
      .mockRejectedValueOnce(overwriteError)
      .mockResolvedValueOnce("revision-overwritten");
    const confirmOverwriteBoard = vi.fn(() => true);
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(makeBoard())),
      saveBoard,
      confirmOverwriteBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");
    useBoardStore.getState().renameBoard("Local edit");
    await vi.waitFor(() =>
      expect(useBoardStore.getState().saveConflict).toBe(true)
    );

    useBoardStore.getState().overwriteBoard();
    await vi.waitFor(() =>
      expect(useBoardStore.getState().conflictResolutionError).toBe(
        toUiError(overwriteError).message,
      )
    );

    expect(useBoardStore.getState()).toMatchObject({
      saveConflict: true,
      saveError: toUiError(conflictError).message,
      conflictResolution: undefined,
      board: expect.objectContaining({ name: "Local edit" }),
    });

    useBoardStore.getState().overwriteBoard();
    await vi.waitFor(() =>
      expect(useBoardStore.getState().saveConflict).toBe(false)
    );
    expect(confirmOverwriteBoard).toHaveBeenCalledTimes(2);
    expect(saveBoard).toHaveBeenNthCalledWith(
      3,
      "/board/development.board.yaml",
      expect.objectContaining({ name: "Local edit" }),
      undefined,
    );
  });

  it("keeps the overwrite error when an edit was queued during the failed overwrite", async () => {
    const overwrite = deferred<string>();
    const overwriteError = new UseCaseError("board.save-failed", {
      path: "/board/development.board.yaml",
    });
    const saveBoard = vi.fn()
      .mockRejectedValueOnce(new UseCaseError("board.conflict"))
      .mockReturnValueOnce(overwrite.promise);
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(makeBoard())),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");
    useBoardStore.getState().renameBoard("Local edit");
    await vi.waitFor(() =>
      expect(useBoardStore.getState().saveConflict).toBe(true)
    );

    useBoardStore.getState().overwriteBoard();
    await vi.waitFor(() => expect(saveBoard).toHaveBeenCalledTimes(2));
    useBoardStore.getState().renameBoard("Edited during overwrite");
    overwrite.reject(overwriteError);

    await vi.waitFor(() =>
      expect(useBoardStore.getState()).toMatchObject({
        isSaving: false,
        saveConflict: true,
        conflictResolutionError: toUiError(overwriteError).message,
        board: expect.objectContaining({ name: "Edited during overwrite" }),
      })
    );
    expect(saveBoard).toHaveBeenCalledTimes(2);
  });

  it("saves an edit queued during overwrite with the overwrite revision", async () => {
    const overwrite = deferred<string>();
    const saveBoard = vi.fn()
      .mockRejectedValueOnce(new UseCaseError("board.conflict"))
      .mockReturnValueOnce(overwrite.promise)
      .mockResolvedValueOnce("revision-latest");
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(makeBoard())),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");
    useBoardStore.getState().renameBoard("Local edit");
    await vi.waitFor(() =>
      expect(useBoardStore.getState().saveConflict).toBe(true)
    );

    useBoardStore.getState().overwriteBoard();
    await vi.waitFor(() => expect(saveBoard).toHaveBeenCalledTimes(2));
    useBoardStore.getState().renameBoard("Edited during overwrite");
    overwrite.resolve("revision-overwritten");

    await vi.waitFor(() => expect(saveBoard).toHaveBeenCalledTimes(3));
    expect(saveBoard).toHaveBeenNthCalledWith(
      3,
      "/board/development.board.yaml",
      expect.objectContaining({ name: "Edited during overwrite" }),
      "revision-overwritten",
    );
    await vi.waitFor(() =>
      expect(useBoardStore.getState()).toMatchObject({
        isSaving: false,
        saveConflict: false,
      })
    );
  });

  it("does not start another overwrite while conflict resolution is in progress", async () => {
    const overwriting = deferred<string>();
    const confirmOverwriteBoard = vi.fn(() => true);
    const saveBoard = vi.fn()
      .mockRejectedValueOnce(new UseCaseError("board.conflict"))
      .mockReturnValueOnce(overwriting.promise);
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(loaded(makeBoard())),
      saveBoard,
      confirmOverwriteBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");
    useBoardStore.getState().renameBoard("Local edit");
    await vi.waitFor(() =>
      expect(useBoardStore.getState().saveConflict).toBe(true)
    );

    useBoardStore.getState().overwriteBoard();
    useBoardStore.getState().overwriteBoard();

    expect(useBoardStore.getState().conflictResolution).toBe("overwriting");
    expect(confirmOverwriteBoard).toHaveBeenCalledOnce();
    expect(saveBoard).toHaveBeenCalledTimes(2);

    overwriting.resolve("revision-overwritten");
    await vi.waitFor(() =>
      expect(useBoardStore.getState().saveConflict).toBe(false)
    );
    expect(useBoardStore.getState().conflictResolution).toBeUndefined();
  });

  it("keeps the conflict when reload and overwrite confirmation are declined", async () => {
    const saveBoard = vi.fn().mockRejectedValue(
      new UseCaseError("board.conflict"),
    );
    const openBoard = vi.fn().mockResolvedValue(loaded(makeBoard()));
    const confirmDiscardBoard = vi.fn(() => false);
    const useBoardStore = createBoardStore(makeDeps({
      openBoard,
      saveBoard,
      confirmDiscardBoard,
      confirmOverwriteBoard: () => false,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");
    useBoardStore.getState().renameBoard("Local edit");
    await vi.waitFor(() =>
      expect(useBoardStore.getState().saveConflict).toBe(true)
    );

    await useBoardStore.getState().reloadBoard();
    useBoardStore.getState().overwriteBoard();

    expect(confirmDiscardBoard.mock.calls).toEqual([["reload"]]);
    expect(openBoard).toHaveBeenCalledOnce();
    expect(saveBoard).toHaveBeenCalledOnce();
    expect(useBoardStore.getState()).toMatchObject({
      board: expect.objectContaining({ name: "Local edit" }),
      saveConflict: true,
    });
  });

  it("does not apply a previous board's late revision to the current board", async () => {
    const oldSave = deferred<string>();
    const firstBoard = makeBoard();
    const secondBoard = makeBoard({ name: "Second" });
    const openBoard = vi.fn()
      .mockResolvedValueOnce(loaded(firstBoard, "first-revision"))
      .mockResolvedValueOnce(loaded(secondBoard, "second-revision"));
    const saveBoard = vi.fn()
      .mockReturnValueOnce(oldSave.promise)
      .mockResolvedValueOnce("second-next-revision");
    const useBoardStore = createBoardStore(makeDeps({ openBoard, saveBoard }));
    await useBoardStore.getState().openBoard("/board/first.board.yaml");
    useBoardStore.getState().renameBoard("First edited");
    await useBoardStore.getState().openBoard("/board/second.board.yaml");

    oldSave.resolve("late-first-revision");
    await vi.waitFor(() =>
      expect(useBoardStore.getState().isSaving).toBe(false)
    );
    useBoardStore.getState().renameBoard("Second edited");
    await vi.waitFor(() => expect(saveBoard).toHaveBeenCalledTimes(2));

    expect(saveBoard).toHaveBeenLastCalledWith(
      "/board/second.board.yaml",
      expect.objectContaining({ name: "Second edited" }),
      "second-revision",
    );
  });

  it("keeps the conflict message when reloading the board fails", async () => {
    const conflict = new UseCaseError("board.conflict");
    const reloadError = new UseCaseError("board.open-failed", {
      path: "/board/development.board.yaml",
    });
    const openBoard = vi.fn()
      .mockResolvedValueOnce(loaded(makeBoard()))
      .mockRejectedValueOnce(reloadError);
    const useBoardStore = createBoardStore(makeDeps({
      openBoard,
      saveBoard: vi.fn().mockRejectedValue(conflict),
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");
    useBoardStore.getState().renameBoard("Local edit");
    await vi.waitFor(() =>
      expect(useBoardStore.getState().saveConflict).toBe(true)
    );

    await useBoardStore.getState().reloadBoard();

    expect(useBoardStore.getState()).toMatchObject({
      saveConflict: true,
      saveError: toUiError(conflict).message,
      conflictResolutionError: toUiError(reloadError).message,
      board: expect.objectContaining({ name: "Local edit" }),
    });
  });
});
