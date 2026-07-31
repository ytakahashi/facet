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
    saveBoard: vi.fn(),
    createMarkdownCard: vi.fn(),
    addExistingMarkdownCard: vi.fn(),
    relocateMarkdownCard: vi.fn(),
    recreateMarkdownCard: vi.fn(),
    createBoard: vi.fn(),
    deleteMarkdown: vi.fn(),
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

describe("createBoardStore", () => {
  it("moves to loaded with the board once openBoard resolves", async () => {
    const board = makeBoard();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(board),
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
    const openBoard = vi.fn().mockResolvedValue(board);
    const createBoard = vi.fn().mockResolvedValue(
      "/boards/facet.board.yaml",
    );
    const useBoardStore = createBoardStore(makeDeps({
      openBoard,
      createBoard,
    }));

    await useBoardStore.getState().createBoard({
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

  it("updates the board immediately, before the save resolves", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn(() => new Promise<void>(() => {}));
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(board),
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
    const saveBoard = vi.fn().mockResolvedValue(undefined);
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(board),
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
    );
  });

  it("keeps the optimistic board and reports an error when saving fails", async () => {
    const board = makeBoard();
    const saveFailedError = new UseCaseError("board.save-failed", {
      path: "/board/development.board.yaml",
    });
    const saveBoard = vi.fn().mockRejectedValue(saveFailedError);
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(board),
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
      .mockResolvedValue(undefined);
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(board),
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
    const saveBoard = vi.fn().mockResolvedValue(undefined);
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(board),
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
    );
  });

  it("does not save when a column is dropped back into its own slot", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn().mockResolvedValue(undefined);
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(board),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().moveColumn("doing", 1);

    expect(useBoardStore.getState().board).toBe(board);
    expect(saveBoard).not.toHaveBeenCalled();
  });

  it("ignores a move of a column that is not on the board", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn().mockResolvedValue(undefined);
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(board),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().moveColumn("missing", 0);

    expect(useBoardStore.getState().board).toBe(board);
    expect(saveBoard).not.toHaveBeenCalled();
  });

  it("appends a new column with the trimmed name at the right end and saves the board", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn().mockResolvedValue(undefined);
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(board),
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
    );
  });

  it("assigns each added column a unique non-empty id", async () => {
    const board = makeBoard();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(board),
      saveBoard: vi.fn().mockResolvedValue(undefined),
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
      openBoard: () => Promise.resolve(board),
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
      openBoard: () => Promise.resolve(board),
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
    const saveBoard = vi.fn().mockResolvedValue(undefined);
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(board),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().renameBoard("  Renamed Board  ");
    await vi.waitFor(() => expect(saveBoard).toHaveBeenCalled());

    expect(useBoardStore.getState().board?.name).toBe("Renamed Board");
    expect(saveBoard).toHaveBeenCalledWith(
      "/board/development.board.yaml",
      useBoardStore.getState().board,
    );
  });

  it("does not change or save the board when the renamed board name is unchanged or blank", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(board),
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
    const saveBoard = vi.fn().mockResolvedValue(undefined);
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(board),
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
    );
  });

  it("does not change or save the board when the renamed name is unchanged or blank", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(board),
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
    const saveBoard = vi.fn().mockResolvedValue(undefined);
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(board),
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
    );
  });

  it("does not change or save the board when removing a column that holds cards", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(board),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().removeColumn("doing");

    expect(useBoardStore.getState().board).toEqual(board);
    expect(saveBoard).not.toHaveBeenCalled();
  });

  it("renames a card with the trimmed title and saves the board", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn().mockResolvedValue(undefined);
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(board),
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
    );
  });

  it("does not change or save the board when the renamed title is unchanged or blank", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(board),
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
      openBoard: () => Promise.resolve(board),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().renameCard("missing.md", "New Title");

    expect(useBoardStore.getState().board).toEqual(board);
    expect(saveBoard).not.toHaveBeenCalled();
  });

  it("sets a card's priority and saves the board", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn().mockResolvedValue(undefined);
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(board),
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
    );
  });

  it("clears a card's priority when set to undefined", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn().mockResolvedValue(undefined);
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(board),
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
    );
  });

  it("does not change or save the board when the priority is unchanged", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(board),
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
      openBoard: () => Promise.resolve(board),
      saveBoard,
    }));
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().setCardPriority("missing.md", "high");

    expect(useBoardStore.getState().board).toEqual(board);
    expect(saveBoard).not.toHaveBeenCalled();
  });

  it("creates a label and saves the board", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn().mockResolvedValue(undefined);
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(board),
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
    );
  });

  it("does not change or save the board for a blank label name", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(board),
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
      openBoard: () => Promise.resolve(board),
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
    const saveBoard = vi.fn().mockResolvedValue(undefined);
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(board),
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
      openBoard: () => Promise.resolve(board),
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
      openBoard: () => Promise.resolve(board),
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
    const saveBoard = vi.fn().mockResolvedValue(undefined);
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(board),
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
      openBoard: () => Promise.resolve(board),
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
    const saveBoard = vi.fn().mockResolvedValue(undefined);
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(board),
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

  it("adds a label to a card and saves the board", async () => {
    const board = makeBoard({ labels: [{ name: "ui", color: "ruby" }] });
    const saveBoard = vi.fn().mockResolvedValue(undefined);
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(board),
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
    );
  });

  it("does not change or save the board when adding a label already on the card", async () => {
    const board = makeBoard({ labels: [{ name: "ui", color: "ruby" }] });
    const saveBoard = vi.fn().mockResolvedValue(undefined);
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(board),
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
      openBoard: () => Promise.resolve(board),
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
    const saveBoard = vi.fn().mockResolvedValue(undefined);
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(board),
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
      openBoard: () => Promise.resolve(board),
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
    const saveBoard = vi.fn().mockResolvedValue(undefined);
    const createMarkdownCard = vi.fn().mockResolvedValue(card);
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(board),
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
    );
  });

  it("rejects a duplicate path before creating the Markdown file", async () => {
    const board = makeBoard();
    const createMarkdownCard = vi.fn();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(board),
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
      openBoard: () => Promise.resolve(board),
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
    const saveBoard = vi.fn().mockResolvedValue(undefined);
    const addExistingMarkdownCard = vi.fn().mockResolvedValue(card);
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(board),
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
      openBoard: () => Promise.resolve(board),
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
      openBoard: () => Promise.resolve(board),
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
      openBoard: () => Promise.resolve(board),
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
      openBoard: () => Promise.resolve(board),
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
    const saveBoard = vi.fn().mockResolvedValue(undefined);
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(board),
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
      openBoard: () => Promise.resolve(board),
      saveBoard: vi.fn(async () => {
        calls.push("save");
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
      openBoard: () => Promise.resolve(board),
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
      openBoard: () => Promise.resolve(board),
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
      openBoard: () => Promise.resolve(board),
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
    const saveBoard = vi.fn().mockResolvedValue(undefined);
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(board),
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
    );
  });

  it("leaves the board untouched when the file cannot be read", async () => {
    const board = makeBrokenBoard();
    const saveBoard = vi.fn();
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(board),
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
      openBoard: () => Promise.resolve(board),
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
      openBoard: () => Promise.resolve(board),
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
    const saveBoard = vi.fn().mockResolvedValue(undefined);
    const useBoardStore = createBoardStore(makeDeps({
      openBoard: () => Promise.resolve(board),
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
      openBoard: () => Promise.resolve(board),
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
      openBoard: () => Promise.resolve(board),
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
      openBoard: () => Promise.resolve(board),
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
      openBoard: () => Promise.resolve(board),
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
});
