import { describe, expect, it, vi } from "vitest";
import type { Board } from "../domain/board.ts";
import { createBoardSaveQueue } from "./boardSaveQueue.ts";

function makeBoard(name: string): Board {
  return { version: 1, name, labels: [], columns: [] };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("createBoardSaveQueue", () => {
  it("saves the board and reports saving then saved", async () => {
    const saveBoard = vi.fn().mockResolvedValue(undefined);
    const onSaving = vi.fn();
    const onSaved = vi.fn();
    const onError = vi.fn();
    const queue = createBoardSaveQueue(saveBoard, {
      onSaving,
      onSaved,
      onError,
    });

    queue.save("/board.yaml", makeBoard("Development"));
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());

    expect(saveBoard).toHaveBeenCalledWith(
      "/board.yaml",
      makeBoard("Development"),
    );
    expect(onSaving).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("reports the error message and does not throw when saving fails", async () => {
    const saveError = new Error("disk full");
    const saveBoard = vi.fn().mockRejectedValue(saveError);
    const onError = vi.fn();
    const queue = createBoardSaveQueue(saveBoard, {
      onSaving: vi.fn(),
      onSaved: vi.fn(),
      onError,
    });

    queue.save("/board.yaml", makeBoard("Development"));
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(saveError));
  });

  it("runs a request that arrives while a save is in flight once the in-flight one settles", async () => {
    const first = deferred<void>();
    const saveBoard = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(undefined);
    const onSaved = vi.fn();
    const queue = createBoardSaveQueue(saveBoard, {
      onSaving: vi.fn(),
      onSaved,
      onError: vi.fn(),
    });

    queue.save("/board.yaml", makeBoard("First"));
    queue.save("/board.yaml", makeBoard("Second"));
    expect(saveBoard).toHaveBeenCalledTimes(1);

    first.resolve();
    await vi.waitFor(() => expect(saveBoard).toHaveBeenCalledTimes(2));

    expect(saveBoard).toHaveBeenLastCalledWith(
      "/board.yaml",
      makeBoard("Second"),
    );
    expect(onSaved).toHaveBeenCalledTimes(2);
  });

  it("keeps only the latest of several requests that arrive during one in-flight save", async () => {
    const first = deferred<void>();
    const saveBoard = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(undefined);
    const queue = createBoardSaveQueue(saveBoard, {
      onSaving: vi.fn(),
      onSaved: vi.fn(),
      onError: vi.fn(),
    });

    queue.save("/board.yaml", makeBoard("First"));
    queue.save("/board.yaml", makeBoard("Second"));
    queue.save("/board.yaml", makeBoard("Third"));
    first.resolve();
    await vi.waitFor(() => expect(saveBoard).toHaveBeenCalledTimes(2));

    expect(saveBoard).toHaveBeenLastCalledWith(
      "/board.yaml",
      makeBoard("Third"),
    );
  });
});
