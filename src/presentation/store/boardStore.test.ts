import { describe, expect, it, vi } from "vitest";
import type { Board } from "../../domain/board.ts";
import { UseCaseError } from "../../usecase/useCaseError.ts";
import { toUiError } from "../errors/toUiError.ts";
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
      vi.fn(),
      vi.fn(),
      vi.fn(),
    );

    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    expect(useBoardStore.getState().status).toBe("loaded");
    expect(useBoardStore.getState().board).toEqual(board);
  });

  it("moves to error with the toUiError message when openBoard rejects", async () => {
    const openBoardError = new UseCaseError("board.open-failed", {
      path: "/board/missing.board.yaml",
    });
    const useBoardStore = createBoardStore(
      () => Promise.reject(openBoardError),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
    );

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
    const useBoardStore = createBoardStore(
      openBoard,
      vi.fn(),
      vi.fn(),
      vi.fn(),
      createBoard,
    );

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
    const useBoardStore = createBoardStore(
      openBoard,
      vi.fn(),
      vi.fn(),
      vi.fn(),
      createBoard,
    );

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
    const useBoardStore = createBoardStore(
      () => Promise.resolve(board),
      saveBoard,
      vi.fn(),
      vi.fn(),
      vi.fn(),
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
      vi.fn(),
      vi.fn(),
      vi.fn(),
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
    const saveFailedError = new UseCaseError("board.save-failed", {
      path: "/board/development.board.yaml",
    });
    const saveBoard = vi.fn().mockRejectedValue(saveFailedError);
    const useBoardStore = createBoardStore(
      () => Promise.resolve(board),
      saveBoard,
      vi.fn(),
      vi.fn(),
      vi.fn(),
    );
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
      { path: "a.md", labels: [], displayTitle: "A" },
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
    const useBoardStore = createBoardStore(
      () => Promise.resolve(board),
      saveBoard,
      vi.fn(),
      vi.fn(),
      vi.fn(),
    );
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

  it("appends a new column with the trimmed name at the right end and saves the board", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn().mockResolvedValue(undefined);
    const useBoardStore = createBoardStore(
      () => Promise.resolve(board),
      saveBoard,
      vi.fn(),
      vi.fn(),
      vi.fn(),
    );
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
    const useBoardStore = createBoardStore(
      () => Promise.resolve(board),
      vi.fn().mockResolvedValue(undefined),
      vi.fn(),
      vi.fn(),
      vi.fn(),
    );
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
    const useBoardStore = createBoardStore(
      () => Promise.resolve(board),
      saveBoard,
      vi.fn(),
      vi.fn(),
      vi.fn(),
    );
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
    const useBoardStore = createBoardStore(
      () => Promise.resolve(board),
      saveBoard,
      vi.fn(),
      vi.fn(),
      vi.fn(),
    );
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
    const useBoardStore = createBoardStore(
      () => Promise.resolve(board),
      saveBoard,
      vi.fn(),
      vi.fn(),
      vi.fn(),
    );
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
    const useBoardStore = createBoardStore(
      () => Promise.resolve(board),
      saveBoard,
      vi.fn(),
      vi.fn(),
      vi.fn(),
    );
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().renameBoard("  Development  ");
    useBoardStore.getState().renameBoard("   ");

    expect(useBoardStore.getState().board).toEqual(board);
    expect(saveBoard).not.toHaveBeenCalled();
  });

  it("renames a column with the trimmed name and saves the board", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn().mockResolvedValue(undefined);
    const useBoardStore = createBoardStore(
      () => Promise.resolve(board),
      saveBoard,
      vi.fn(),
      vi.fn(),
      vi.fn(),
    );
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
    const useBoardStore = createBoardStore(
      () => Promise.resolve(board),
      saveBoard,
      vi.fn(),
      vi.fn(),
      vi.fn(),
    );
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().renameColumn("doing", "  Doing  ");
    useBoardStore.getState().renameColumn("doing", "   ");

    expect(useBoardStore.getState().board).toEqual(board);
    expect(saveBoard).not.toHaveBeenCalled();
  });

  it("removes an empty column and saves the board", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn().mockResolvedValue(undefined);
    const useBoardStore = createBoardStore(
      () => Promise.resolve(board),
      saveBoard,
      vi.fn(),
      vi.fn(),
      vi.fn(),
    );
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
    const useBoardStore = createBoardStore(
      () => Promise.resolve(board),
      saveBoard,
      vi.fn(),
      vi.fn(),
      vi.fn(),
    );
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().removeColumn("doing");

    expect(useBoardStore.getState().board).toEqual(board);
    expect(saveBoard).not.toHaveBeenCalled();
  });

  it("renames a card with the trimmed title and saves the board", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn().mockResolvedValue(undefined);
    const useBoardStore = createBoardStore(
      () => Promise.resolve(board),
      saveBoard,
      vi.fn(),
      vi.fn(),
      vi.fn(),
    );
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
    const useBoardStore = createBoardStore(
      () => Promise.resolve(board),
      saveBoard,
      vi.fn(),
      vi.fn(),
      vi.fn(),
    );
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().renameCard("a.md", "  A  ");
    useBoardStore.getState().renameCard("a.md", "   ");

    expect(useBoardStore.getState().board).toEqual(board);
    expect(saveBoard).not.toHaveBeenCalled();
  });

  it("does not change or save the board when renaming an unknown card path", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn();
    const useBoardStore = createBoardStore(
      () => Promise.resolve(board),
      saveBoard,
      vi.fn(),
      vi.fn(),
      vi.fn(),
    );
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().renameCard("missing.md", "New Title");

    expect(useBoardStore.getState().board).toEqual(board);
    expect(saveBoard).not.toHaveBeenCalled();
  });

  it("sets a card's priority and saves the board", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn().mockResolvedValue(undefined);
    const useBoardStore = createBoardStore(
      () => Promise.resolve(board),
      saveBoard,
      vi.fn(),
      vi.fn(),
      vi.fn(),
    );
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
    const useBoardStore = createBoardStore(
      () => Promise.resolve(board),
      saveBoard,
      vi.fn(),
      vi.fn(),
      vi.fn(),
    );
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
    const useBoardStore = createBoardStore(
      () => Promise.resolve(board),
      saveBoard,
      vi.fn(),
      vi.fn(),
      vi.fn(),
    );
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().setCardPriority("a.md", undefined);

    expect(useBoardStore.getState().board).toEqual(board);
    expect(saveBoard).not.toHaveBeenCalled();
  });

  it("does not change or save the board when setting priority on an unknown card", async () => {
    const board = makeBoard();
    const saveBoard = vi.fn();
    const useBoardStore = createBoardStore(
      () => Promise.resolve(board),
      saveBoard,
      vi.fn(),
      vi.fn(),
      vi.fn(),
    );
    await useBoardStore.getState().openBoard("/board/development.board.yaml");

    useBoardStore.getState().setCardPriority("missing.md", "high");

    expect(useBoardStore.getState().board).toEqual(board);
    expect(saveBoard).not.toHaveBeenCalled();
  });

  it("creates a Markdown card, appends it, and saves the updated board", async () => {
    const board = makeBoard();
    const card = {
      path: "new-card.md",
      absolutePath: "/board/new-card.md",
      labels: [],
      displayTitle: "New card",
    };
    const saveBoard = vi.fn().mockResolvedValue(undefined);
    const createMarkdownCard = vi.fn().mockResolvedValue(card);
    const useBoardStore = createBoardStore(
      () => Promise.resolve(board),
      saveBoard,
      createMarkdownCard,
      vi.fn(),
      vi.fn(),
    );
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
      { path: "a.md", labels: [], displayTitle: "A" },
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
    const useBoardStore = createBoardStore(
      () => Promise.resolve(board),
      vi.fn(),
      createMarkdownCard,
      vi.fn(),
      vi.fn(),
    );
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
    const useBoardStore = createBoardStore(
      () => Promise.resolve(board),
      saveBoard,
      createMarkdownCard,
      vi.fn(),
      vi.fn(),
    );
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
      labels: [],
      displayTitle: "Existing",
    };
    const saveBoard = vi.fn().mockResolvedValue(undefined);
    const addExistingMarkdownCard = vi.fn().mockResolvedValue(card);
    const useBoardStore = createBoardStore(
      () => Promise.resolve(board),
      saveBoard,
      vi.fn(),
      addExistingMarkdownCard,
      vi.fn(),
    );
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
    const useBoardStore = createBoardStore(
      () => Promise.resolve(board),
      vi.fn(),
      vi.fn(),
      addExistingMarkdownCard,
      vi.fn(),
    );
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
    const useBoardStore = createBoardStore(
      () => Promise.resolve(board),
      saveBoard,
      vi.fn(),
      addExistingMarkdownCard,
      vi.fn(),
    );
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
    const card = {
      path: "existing.md",
      absolutePath: "/board/existing.md",
      labels: [],
      displayTitle: "Existing",
    };
    let finishLoading: (loadedCard: typeof card) => void = () => {};
    const loading = new Promise<typeof card>((resolve) => {
      finishLoading = resolve;
    });
    const saveBoard = vi.fn();
    const useBoardStore = createBoardStore(
      () => Promise.resolve(board),
      saveBoard,
      vi.fn(),
      vi.fn().mockReturnValue(loading),
      vi.fn(),
    );
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
      labels: [],
      displayTitle: "Existing",
    };
    const saveBoard = vi.fn().mockRejectedValue(
      new UseCaseError("board.save-failed", {
        path: "/board/development.board.yaml",
      }),
    );
    const useBoardStore = createBoardStore(
      () => Promise.resolve(board),
      saveBoard,
      vi.fn(),
      vi.fn().mockResolvedValue(card),
      vi.fn(),
    );
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
});
