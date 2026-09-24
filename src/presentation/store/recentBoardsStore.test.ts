import { describe, expect, it } from "vitest";
import type { RecentBoardEntry } from "../../usecase/listRecentBoardEntries.ts";
import { UseCaseError } from "../../usecase/useCaseError.ts";
import { createRecentBoardsStore } from "./recentBoardsStore.ts";

const alpha: RecentBoardEntry = {
  path: "/boards/a.board.yaml",
  status: "available",
  name: "Alpha",
};
const gone: RecentBoardEntry = {
  path: "/boards/gone.board.yaml",
  status: "missing",
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("createRecentBoardsStore", () => {
  it("holds the entries it loads", async () => {
    const useRecentBoards = createRecentBoardsStore({
      list: () => Promise.resolve([alpha, gone]),
      remove: () => Promise.resolve(),
    });

    await useRecentBoards.getState().load();

    expect(useRecentBoards.getState().entries).toEqual([alpha, gone]);
    expect(useRecentBoards.getState().error).toBeUndefined();
  });

  it("drops a removed entry without reloading the list", async () => {
    const removed: string[] = [];
    const useRecentBoards = createRecentBoardsStore({
      list: () => Promise.resolve([alpha, gone]),
      remove: (path) => {
        removed.push(path);
        return Promise.resolve();
      },
    });
    await useRecentBoards.getState().load();

    await useRecentBoards.getState().remove(gone.path);

    expect(removed).toEqual([gone.path]);
    expect(useRecentBoards.getState().entries).toEqual([alpha]);
  });

  it("keeps the entry and reports the error when removal fails", async () => {
    const useRecentBoards = createRecentBoardsStore({
      list: () => Promise.resolve([alpha]),
      remove: (path) =>
        Promise.reject(
          new UseCaseError("recent-boards.remove-failed", { path }),
        ),
    });
    await useRecentBoards.getState().load();

    await useRecentBoards.getState().remove(alpha.path);

    expect(useRecentBoards.getState().entries).toEqual([alpha]);
    expect(useRecentBoards.getState().error).toBeDefined();
  });

  it("ignores a load that was in flight when a board was removed", async () => {
    const staleList = deferred<RecentBoardEntry[]>();
    let listCalls = 0;
    const useRecentBoards = createRecentBoardsStore({
      list: () =>
        ++listCalls === 1 ? Promise.resolve([alpha, gone]) : staleList.promise,
      remove: () => Promise.resolve(),
    });
    await useRecentBoards.getState().load();
    const staleLoad = useRecentBoards.getState().load();

    await useRecentBoards.getState().remove(gone.path);
    staleList.resolve([alpha, gone]);
    await staleLoad;

    expect(useRecentBoards.getState().entries).toEqual([alpha]);
  });

  it("reports a load failure", async () => {
    const useRecentBoards = createRecentBoardsStore({
      list: () => Promise.reject(new UseCaseError("recent-boards.load-failed")),
      remove: () => Promise.resolve(),
    });

    await useRecentBoards.getState().load();

    expect(useRecentBoards.getState().error).toBeDefined();
  });
});
