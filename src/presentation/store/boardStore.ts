import { create } from "zustand";
import type { StoreApi, UseBoundStore } from "zustand";
import type { Board } from "../../domain/board.ts";

export type BoardStatus = "empty" | "loading" | "loaded" | "error";

export interface BoardState {
  status: BoardStatus;
  board?: Board;
  error?: string;
  openBoard: (path: string) => Promise<void>;
}

export type OpenBoard = (path: string) => Promise<Board>;

export function createBoardStore(
  openBoard: OpenBoard,
): UseBoundStore<StoreApi<BoardState>> {
  return create<BoardState>((set) => ({
    status: "empty",
    openBoard: async (path: string) => {
      set({ status: "loading", error: undefined });
      try {
        const board = await openBoard(path);
        set({ status: "loaded", board });
      } catch (error) {
        set({
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  }));
}
