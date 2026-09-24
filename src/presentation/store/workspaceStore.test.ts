import { create } from "zustand";
import { describe, expect, it, vi } from "vitest";
import type { CreateBoardInput } from "../../usecase/createBoard.ts";
import type { BoardSession } from "../context/appContext.ts";
import type { BoardState } from "./boardStore.ts";
import { createFilterStore } from "./filterStore.ts";
import type { MarkdownViewerState } from "./markdownViewerStore.ts";
import { createWorkspaceStore } from "./workspaceStore.ts";

const input: CreateBoardInput = {
  directory: "/boards",
  fileName: "new.board.yaml",
  name: "New",
};

function makeSession(overrides: {
  openBoard?: BoardState["openBoard"];
  createBoard?: BoardState["createBoard"];
  close?: MarkdownViewerState["close"];
} = {}): BoardSession {
  return {
    boardStore: create<BoardState>(() => ({
      status: "empty",
      isSaving: false,
      saveConflict: false,
      openBoard: overrides.openBoard ?? vi.fn().mockResolvedValue(undefined),
      createBoard: overrides.createBoard ??
        vi.fn().mockResolvedValue("/boards/new.board.yaml"),
    } as BoardState)),
    markdownViewer: create<MarkdownViewerState>(() => ({
      status: "idle",
      close: overrides.close ?? vi.fn(() => true),
    } as MarkdownViewerState)),
    filterStore: createFilterStore(),
  };
}

describe("createWorkspaceStore", () => {
  it("adds a tab before loading and reuses it for the same path", () => {
    const openBoard = vi.fn(() => new Promise<void>(() => {}));
    const createSession = vi.fn(() => makeSession({ openBoard }));
    const workspace = createWorkspaceStore({
      createSession,
      confirmCloseBoard: vi.fn(() => true),
    });

    workspace.getState().openBoard("/boards/a.board.yaml");
    const firstTab = workspace.getState().tabs[0];
    expect(firstTab.path).toBe("/boards/a.board.yaml");
    expect(workspace.getState().activeTabId).toBe(firstTab.id);
    expect(openBoard).toHaveBeenCalledWith(firstTab.path);

    workspace.getState().showStartScreen();
    workspace.getState().openBoard(firstTab.path);
    expect(createSession).toHaveBeenCalledOnce();
    expect(openBoard).toHaveBeenCalledOnce();
    expect(workspace.getState().activeTabId).toBe(firstTab.id);
  });

  it("keeps a tab when loading reports an error", async () => {
    const session = makeSession();
    session.boardStore.setState({
      openBoard: async () => {
        session.boardStore.setState({ status: "error", error: "Cannot open" });
      },
    });
    const workspace = createWorkspaceStore({
      createSession: () => session,
      confirmCloseBoard: () => true,
    });

    workspace.getState().openBoard("/boards/missing.board.yaml");
    await vi.waitFor(() =>
      expect(session.boardStore.getState().status).toBe("error")
    );
    expect(workspace.getState().tabs).toHaveLength(1);
  });

  it("retries an errored tab only when its path is opened again", () => {
    const session = makeSession();
    const openBoard = vi.fn(() => {
      session.boardStore.setState({
        status: openBoard.mock.calls.length === 1 ? "error" : "loaded",
      });
      return Promise.resolve();
    });
    session.boardStore.setState({ openBoard });
    const createSession = vi.fn(() => session);
    const workspace = createWorkspaceStore({
      createSession,
      confirmCloseBoard: () => true,
    });
    const path = "/boards/a.board.yaml";

    workspace.getState().openBoard(path);
    const tab = workspace.getState().tabs[0];
    workspace.getState().showStartScreen();
    workspace.getState().activateTab(tab.id);
    expect(openBoard).toHaveBeenCalledOnce();

    workspace.getState().openBoard(path);
    expect(openBoard).toHaveBeenCalledTimes(2);
    expect(createSession).toHaveBeenCalledOnce();
    expect(workspace.getState().tabs).toEqual([tab]);
    expect(workspace.getState().activeTabId).toBe(tab.id);
    expect(session.boardStore.getState().status).toBe("loaded");
  });

  it("adds a created board using the path returned by its store", async () => {
    const createBoard = vi.fn().mockResolvedValue("/boards/new.board.yaml");
    const workspace = createWorkspaceStore({
      createSession: () => makeSession({ createBoard }),
      confirmCloseBoard: () => true,
    });

    await workspace.getState().createBoard(input);

    expect(createBoard).toHaveBeenCalledWith(input);
    expect(workspace.getState().tabs[0].path).toBe("/boards/new.board.yaml");
    expect(workspace.getState().activeTabId).toBe(
      workspace.getState().tabs[0].id,
    );
  });

  it("leaves the workspace alone when file creation fails", async () => {
    const failure = new Error("Cannot create");
    const workspace = createWorkspaceStore({
      createSession: () =>
        makeSession({ createBoard: () => Promise.reject(failure) }),
      confirmCloseBoard: () => true,
    });

    await expect(workspace.getState().createBoard(input)).rejects.toBe(failure);
    expect(workspace.getState().tabs).toEqual([]);
  });

  it("keeps a created file's tab when its read-back fails", async () => {
    const session = makeSession({
      createBoard: () => Promise.resolve("/boards/new.board.yaml"),
    });
    session.boardStore.setState({ status: "error", error: "Cannot read" });
    const workspace = createWorkspaceStore({
      createSession: () => session,
      confirmCloseBoard: () => true,
    });

    await workspace.getState().createBoard(input);
    expect(workspace.getState().tabs[0].path).toBe("/boards/new.board.yaml");
    expect(session.boardStore.getState().error).toBe("Cannot read");
  });

  it("keeps the viewer open when the board close prompt is declined", () => {
    const close = vi.fn(() => true);
    const confirmCloseBoard = vi.fn(() => false);
    const session = makeSession({ close });
    const workspace = createWorkspaceStore({
      createSession: () => session,
      confirmCloseBoard,
    });
    workspace.getState().openBoard("/boards/a.board.yaml");
    session.boardStore.setState({ isSaving: true });

    expect(workspace.getState().closeTab(workspace.getState().tabs[0].id)).toBe(
      false,
    );
    expect(confirmCloseBoard).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
    expect(workspace.getState().tabs).toHaveLength(1);
  });

  it("closes a clean tab without a board confirmation", () => {
    const confirmCloseBoard = vi.fn(() => false);
    const workspace = createWorkspaceStore({
      createSession: () => makeSession(),
      confirmCloseBoard,
    });
    workspace.getState().openBoard("/boards/a.board.yaml");

    expect(workspace.getState().closeTab(workspace.getState().tabs[0].id)).toBe(
      true,
    );
    expect(confirmCloseBoard).not.toHaveBeenCalled();
  });

  it("confirms board changes before closing the viewer", () => {
    const order: string[] = [];
    const workspace = createWorkspaceStore({
      createSession: () =>
        makeSession({
          close: () => {
            order.push("viewer");
            return true;
          },
        }),
      confirmCloseBoard: () => {
        order.push("board");
        return true;
      },
    });
    workspace.getState().openBoard("/boards/a.board.yaml");
    workspace.getState().tabs[0].session.boardStore.setState({
      isSaving: true,
    });

    expect(workspace.getState().closeTab(workspace.getState().tabs[0].id)).toBe(
      true,
    );
    expect(order).toEqual(["board", "viewer"]);
  });

  it.each([
    { name: "a failed save", state: { saveError: "Cannot save" } },
    { name: "a save conflict", state: { saveConflict: true } },
  ])("confirms before closing a tab with $name", ({ state }) => {
    const confirmCloseBoard = vi.fn(() => false);
    const session = makeSession();
    const workspace = createWorkspaceStore({
      createSession: () => session,
      confirmCloseBoard,
    });
    workspace.getState().openBoard("/boards/a.board.yaml");
    session.boardStore.setState(state);

    expect(workspace.getState().closeTab(workspace.getState().tabs[0].id)).toBe(
      false,
    );
    expect(confirmCloseBoard).toHaveBeenCalledOnce();
  });

  it("keeps the tab when the viewer refuses to close", () => {
    const session = makeSession({ close: () => false });
    const workspace = createWorkspaceStore({
      createSession: () => session,
      confirmCloseBoard: () => true,
    });
    workspace.getState().openBoard("/boards/a.board.yaml");

    expect(workspace.getState().closeTab(workspace.getState().tabs[0].id)).toBe(
      false,
    );
    expect(workspace.getState().tabs).toHaveLength(1);
  });

  it("selects the right neighbor, then the left, then the start screen", () => {
    const workspace = createWorkspaceStore({
      createSession: () => makeSession(),
      confirmCloseBoard: () => true,
    });
    for (const path of ["a", "b", "c"]) workspace.getState().openBoard(path);
    const [a, b, c] = workspace.getState().tabs;

    workspace.getState().activateTab(b.id);
    expect(workspace.getState().closeTab(b.id)).toBe(true);
    expect(workspace.getState().activeTabId).toBe(c.id);
    expect(workspace.getState().closeTab(c.id)).toBe(true);
    expect(workspace.getState().activeTabId).toBe(a.id);
    expect(workspace.getState().closeTab(a.id)).toBe(true);
    expect(workspace.getState().activeTabId).toBeUndefined();
  });

  it("preserves the active tab when another tab closes", () => {
    const workspace = createWorkspaceStore({
      createSession: () => makeSession(),
      confirmCloseBoard: () => true,
    });
    workspace.getState().openBoard("a");
    workspace.getState().openBoard("b");
    const [a, b] = workspace.getState().tabs;

    expect(workspace.getState().closeTab(a.id)).toBe(true);
    expect(workspace.getState().activeTabId).toBe(b.id);
  });

  it("shows the start screen without discarding open tabs", () => {
    const workspace = createWorkspaceStore({
      createSession: () => makeSession(),
      confirmCloseBoard: () => true,
    });
    workspace.getState().openBoard("a");
    const tab = workspace.getState().tabs[0];

    workspace.getState().showStartScreen();
    expect(workspace.getState().activeTabId).toBeUndefined();
    expect(workspace.getState().tabs).toEqual([tab]);
    workspace.getState().activateTab(tab.id);
    expect(workspace.getState().activeTabId).toBe(tab.id);
  });
});
