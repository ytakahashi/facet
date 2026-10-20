import { create } from "zustand";
import { describe, expect, it, vi } from "vite-plus/test";
import { UseCaseError } from "../../usecase/useCaseError.ts";
import type { Card } from "../../domain/card.ts";
import type { BoardState } from "./boardStore.ts";
import { createFileAdditionStore } from "./fileAdditionStore.ts";

function boardStore(addExistingCard: BoardState["addExistingCard"]) {
  return create<BoardState>(
    () => ({ path: "/board/board.yaml", addExistingCard }) as BoardState,
  );
}

describe("file addition", () => {
  it("deduplicates equivalent paths while adding, clears success, and passes the chosen column", async () => {
    let resolve!: (card: Card) => void;
    const pending = new Promise<Card>((yes) => {
      resolve = yes;
    });
    const add = vi.fn(() => pending);
    const store = createFileAdditionStore(boardStore(add));
    const first = store
      .getState()
      .addFile("/board/board.yaml", "Docs/Café.md", "todo");
    await store
      .getState()
      .addFile("/board/board.yaml", "docs/Cafe\u0301.md", "done");
    expect(add).toHaveBeenCalledExactlyOnceWith({
      absolutePath: "/board/Docs/Café.md",
      columnId: "todo",
    });
    expect(store.getState().additions.get("docs/café.md")?.status).toBe(
      "adding",
    );
    resolve({
      path: "Docs/Café.md",
      displayTitle: "Café",
      fileState: "available",
      labels: [],
    });
    await first;
    expect(store.getState().additions.size).toBe(0);
  });

  it("catches failures and allows another menu selection to retry", async () => {
    const add = vi
      .fn()
      .mockRejectedValueOnce(new UseCaseError("card.load-failed"))
      .mockResolvedValue({});
    const store = createFileAdditionStore(boardStore(add));
    await store.getState().addFile("/board/board.yaml", "notes.md", "todo");
    expect(store.getState().additions.get("notes.md")?.status).toBe("failed");
    await store.getState().addFile("/board/board.yaml", "notes.md", "done");
    expect(add).toHaveBeenCalledTimes(2);
    expect(store.getState().additions.size).toBe(0);
  });

  it("rejects a selection from a menu opened for an earlier board", async () => {
    const add = vi.fn();
    const board = boardStore(add);
    const store = createFileAdditionStore(board);
    board.setState({ path: "/other/board.yaml" });
    await store.getState().addFile("/board/board.yaml", "notes.md", "todo");
    expect(add).not.toHaveBeenCalled();
    expect(store.getState().additions.get("notes.md")?.status).toBe("failed");
  });
});
