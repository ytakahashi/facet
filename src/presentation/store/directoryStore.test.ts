import { describe, expect, it, vi } from "vite-plus/test";
import type { DirEntry } from "../../domain/fileSystemPort.ts";
import { UseCaseError } from "../../usecase/useCaseError.ts";
import { createDirectoryStore } from "./directoryStore.ts";

function deferred() {
  let resolve!: (entries: DirEntry[]) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<DirEntry[]>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

const entries: DirEntry[] = [{ name: "notes.md", isDirectory: false }];

describe("directory store", () => {
  it("deduplicates reads, caches closed directories, and isolates sessions", async () => {
    const read = vi.fn().mockResolvedValue(entries);
    const store = createDirectoryStore(read);
    const other = createDirectoryStore(read);
    store.getState().begin("/board");
    const targets = new Map([
      ["", ""],
      ["docs", "Docs"],
    ]);
    store.getState().setTargets(targets);
    store.getState().setTargets(targets);
    expect(read.mock.calls).toEqual([["/board"], ["/board/Docs"]]);
    await vi.waitFor(() =>
      expect(store.getState().scans.get("docs")?.status).toBe("scanned"),
    );
    store.getState().setTargets(new Map());
    store.getState().setTargets(targets);
    expect(read).toHaveBeenCalledTimes(2);
    expect(store.getState().snapshots.get("docs")).toEqual(entries);
    expect(other.getState().snapshots.size).toBe(0);
  });

  it("bounds host reads across generations and removes closed queued targets", async () => {
    const pending = Array.from({ length: 5 }, deferred);
    const read = vi.fn();
    pending.forEach((request) => read.mockReturnValueOnce(request.promise));
    const store = createDirectoryStore(read);
    store.getState().begin("/old");
    store
      .getState()
      .setTargets(new Map([0, 1, 2, 3, 4].map((n) => [String(n), String(n)])));
    expect(read).toHaveBeenCalledTimes(4);
    store.getState().setTargets(new Map([["0", "0"]]));
    pending[0].resolve([]);
    await vi.waitFor(() =>
      expect(store.getState().scans.get("0")?.status).toBe("scanned"),
    );
    expect(read).toHaveBeenCalledTimes(4);
    store.getState().begin("/new");
    store.getState().setTargets(new Map([["", ""]]));
    expect(read).toHaveBeenCalledTimes(5);
    pending[1].resolve(entries);
    pending[2].reject(new Error("stale failure"));
    pending[3].resolve(entries);
    pending[4].resolve([]);
    await vi.waitFor(() =>
      expect(store.getState().scans.get("")?.status).toBe("scanned"),
    );
    expect([...store.getState().scans.keys()]).toEqual([""]);
    expect([...store.getState().snapshots]).toEqual([["", []]]);
  });

  it("retries only failed visible targets and stops scheduling after unmount", async () => {
    const failed = new UseCaseError("directory.browse-failed", {
      path: "/board/docs",
    });
    const read = vi
      .fn()
      .mockRejectedValueOnce(failed)
      .mockResolvedValue(entries);
    const store = createDirectoryStore(read);
    store.getState().begin("/board");
    const targets = new Map([["docs", "docs"]]);
    store.getState().setTargets(targets);
    await vi.waitFor(() =>
      expect(store.getState().scans.get("docs")?.status).toBe("failed"),
    );
    store.getState().setTargets(targets);
    expect(read).toHaveBeenCalledTimes(1);
    store.getState().retry("docs");
    await vi.waitFor(() =>
      expect(store.getState().snapshots.get("docs")).toEqual(entries),
    );
    store.getState().retry("docs");
    expect(read).toHaveBeenCalledTimes(2);
    store.getState().stop();
    store.getState().setTargets(new Map([["later", "later"]]));
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("clears listings on stop, discards a later completion, then rereads on the next visit", async () => {
    const old = deferred();
    const read = vi
      .fn()
      .mockResolvedValueOnce(entries)
      .mockReturnValueOnce(old.promise)
      .mockResolvedValue([]);
    const store = createDirectoryStore(read);
    store.getState().begin("/board");
    store.getState().setTargets(new Map([["docs", "docs"]]));
    await vi.waitFor(() =>
      expect(store.getState().snapshots.get("docs")).toEqual(entries),
    );
    store.getState().setTargets(new Map([["", ""]]));
    store.getState().stop();
    expect(store.getState().scans.size).toBe(0);
    old.resolve(entries);
    await old.promise;
    expect(store.getState().snapshots.size).toBe(0);
    store.getState().begin("/board");
    store.getState().setTargets(new Map([["", ""]]));
    await vi.waitFor(() =>
      expect(store.getState().snapshots.get("")).toEqual([]),
    );
    expect(read).toHaveBeenCalledTimes(3);
  });
});
