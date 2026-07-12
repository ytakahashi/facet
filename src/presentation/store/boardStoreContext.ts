import { createContext, useContext } from "react";
import type { StoreApi, UseBoundStore } from "zustand";
import type { BoardState } from "./boardStore.ts";

// `boardStore.ts` only exports a factory (`createBoardStore`) that takes an
// `openBoard` function.
// This context exists for components to depend only on the store's shape,
// not its concrete implementation.
// Whatever wires the real instance provides it once, high up the tree,
// via `BoardStoreProvider`.

type BoardStore = UseBoundStore<StoreApi<BoardState>>;

const BoardStoreContext = createContext<BoardStore | null>(null);

export const BoardStoreProvider = BoardStoreContext.Provider;

export function useBoardStore<T>(selector: (state: BoardState) => T): T {
  const store = useContext(BoardStoreContext);
  if (!store) {
    throw new Error("useBoardStore must be used within a BoardStoreProvider");
  }
  return store(selector);
}
