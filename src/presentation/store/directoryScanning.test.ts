import { create } from "zustand";
import { describe, expect, it, vi } from "vite-plus/test";
import type { Board } from "../../domain/board.ts";
import type { DirEntry } from "../../domain/fileSystemPort.ts";
import type { BoardSession } from "../context/appContext.ts";
import type { BoardState } from "./boardStore.ts";
import type { MarkdownViewerState } from "./markdownViewerStore.ts";
import { createBoardViewStore } from "./boardViewStore.ts";
import { createFilterStore } from "./filterStore.ts";
import { createDirectoryStore } from "./directoryStore.ts";
import { createFileAdditionStore } from "./fileAdditionStore.ts";
import { startDirectoryScanning } from "./directoryScanning.ts";

function session(read: (path: string) => Promise<DirEntry[]>): BoardSession {
  const board: Board = {
    version: 1,
    name: "Test",
    labels: [],
    columns: [
      {
        id: "todo",
        name: "Todo",
        cards: [
          {
            path: "docs/deep/task.md",
            displayTitle: "Task",
            labels: [],
            fileState: "available",
          },
        ],
      },
    ],
  };
  const boardStore = create<BoardState>(
    () =>
      ({ board, path: "/board/board.yaml", loadGeneration: 1 }) as BoardState,
  );
  return {
    boardStore,
    boardView: createBoardViewStore(),
    fileAddition: createFileAdditionStore(boardStore),
    directoryStore: createDirectoryStore(read),
    filterStore: createFilterStore(),
    markdownViewer: create<MarkdownViewerState>(
      () => ({}) as MarkdownViewerState,
    ),
  };
}

describe("directory scanning lifecycle", () => {
  it("can scan a board stored directly under the file-system root", () => {
    const read = vi.fn().mockResolvedValue([]);
    const s = session(read);
    s.boardStore.setState({ path: "/board.yaml" });
    const stop = startDirectoryScanning(s);
    expect(read.mock.calls).toEqual([["/"], ["/docs"], ["/docs/deep"]]);
    stop();
  });
  it("reads the root and expanded card ancestors, discovers FS branches without reading them", async () => {
    const read = vi.fn(async (path: string): Promise<DirEntry[]> =>
      path === "/board" ? [{ name: "large", isDirectory: true }] : [],
    );
    const s = session(read);
    const stop = startDirectoryScanning(s);
    await vi.waitFor(() =>
      expect(s.directoryStore.getState().scans.get("")?.status).toBe("scanned"),
    );
    expect(read.mock.calls).toEqual([
      ["/board"],
      ["/board/docs"],
      ["/board/docs/deep"],
    ]);
    s.boardView.getState().setDirectoryExpanded("large", true);
    expect(read).toHaveBeenLastCalledWith("/board/large");
    stop();
  });

  it("honors collapsed ancestors and preserves expansion on reload and remount", async () => {
    const read = vi.fn().mockResolvedValue([]);
    const s = session(read);
    s.boardView.getState().setDirectoryExpanded("docs", false);
    let stop = startDirectoryScanning(s);
    await vi.waitFor(() =>
      expect(s.directoryStore.getState().scans.get("")?.status).toBe("scanned"),
    );
    expect(read.mock.calls).toEqual([["/board"]]);
    s.boardStore.setState({ refreshError: "Failed refresh" });
    s.boardStore.setState({
      board: { ...s.boardStore.getState().board!, name: "Local edit" },
    });
    expect(read).toHaveBeenCalledTimes(1);
    s.boardStore.setState({ loadGeneration: 2 });
    expect(read).toHaveBeenCalledTimes(2);
    stop();
    stop = startDirectoryScanning(s);
    expect(read).toHaveBeenCalledTimes(3);
    expect(s.boardView.getState().directoryExpansion.get("docs")).toBe(false);
    stop();
  });

  it("clears addition failures, but not pending additions, when a new scan begins", () => {
    const s = session(vi.fn().mockResolvedValue([]));
    const additions = new Map([
      ["failed.md", { status: "failed", message: "Cannot add file" }],
      ["pending.md", { status: "adding" }],
    ] as const);
    s.fileAddition.setState({ additions: new Map(additions) });
    const stop = startDirectoryScanning(s);
    expect([...s.fileAddition.getState().additions.keys()]).toEqual([
      "pending.md",
    ]);
    s.fileAddition.setState({ additions: new Map(additions) });
    s.boardStore.setState({ loadGeneration: 2 });
    expect([...s.fileAddition.getState().additions.keys()]).toEqual([
      "pending.md",
    ]);
    stop();
  });

  it("pauses reads under an active filter and starts after clearing it", () => {
    const read = vi.fn().mockResolvedValue([]);
    const s = session(read);
    s.filterStore.setState({
      criteria: { labels: new Set(["bug"]), hiddenColumnIds: new Set() },
    });
    const stop = startDirectoryScanning(s);
    expect(read).not.toHaveBeenCalled();
    s.filterStore.setState({
      criteria: { labels: new Set(), hiddenColumnIds: new Set() },
    });
    expect(read).toHaveBeenCalledTimes(3);
    stop();
  });

  it("keeps known card branches usable when their parent cannot be read", async () => {
    const read = vi.fn(async (path: string): Promise<DirEntry[]> => {
      if (path === "/board") throw new Error("Unavailable root");
      return [];
    });
    const s = session(read);
    const stop = startDirectoryScanning(s);
    await vi.waitFor(() =>
      expect(s.directoryStore.getState().scans.get("")?.status).toBe("failed"),
    );
    expect(s.directoryStore.getState().scans.get("docs/deep")?.status).toBe(
      "scanned",
    );
    expect(read).toHaveBeenCalledTimes(3);
    stop();
  });

  it("drops queued descendant reads when their ancestor closes", async () => {
    let release!: (entries: DirEntry[]) => void;
    const pending = new Promise<DirEntry[]>((resolve) => {
      release = resolve;
    });
    const read = vi.fn(() => pending);
    const s = session(read);
    const board = s.boardStore.getState().board!;
    s.boardStore.setState({
      board: {
        ...board,
        columns: [
          {
            ...board.columns[0],
            cards: Array.from({ length: 6 }, (_, n) => ({
              ...board.columns[0].cards[0],
              path: `docs/d${n}/task.md`,
            })),
          },
        ],
      },
    });
    const stop = startDirectoryScanning(s);
    expect(read).toHaveBeenCalledTimes(4);
    s.boardView.getState().setDirectoryExpanded("docs", false);
    release([]);
    await vi.waitFor(() =>
      expect(s.directoryStore.getState().scans.get("")?.status).toBe("scanned"),
    );
    expect(read).toHaveBeenCalledTimes(4);
    stop();
  });
});
