import { create } from "zustand";
import type { StoreApi, UseBoundStore } from "zustand";
import type { Board, CardLocation } from "../../domain/board.ts";
import { moveCard as moveCardDomain } from "../../domain/board.ts";
import type { SaveBoard } from "../../usecase/boardSaveQueue.ts";
import { createBoardSaveQueue } from "../../usecase/boardSaveQueue.ts";

export type BoardStatus = "empty" | "loading" | "loaded" | "error";

export interface BoardState {
  status: BoardStatus;
  board?: Board;
  path?: string;
  error?: string;
  isSaving: boolean;
  saveError?: string;
  openBoard: (path: string) => Promise<void>;
  moveCard: (from: CardLocation, to: CardLocation) => void;
  retrySave: () => void;
}

export type OpenBoard = (path: string) => Promise<Board>;
export type { SaveBoard };

export function createBoardStore(
  openBoard: OpenBoard,
  saveBoard: SaveBoard,
): UseBoundStore<StoreApi<BoardState>> {
  return create<BoardState>((set, get) => {
    const saveQueue = createBoardSaveQueue(saveBoard, {
      onSaving: () => set({ isSaving: true, saveError: undefined }),
      onSaved: () => set({ isSaving: false }),
      onError: (message) => set({ isSaving: false, saveError: message }),
    });

    return {
      status: "empty",
      isSaving: false,
      openBoard: async (path: string) => {
        set({ status: "loading", error: undefined });
        try {
          const board = await openBoard(path);
          set({ status: "loaded", board, path });
        } catch (error) {
          set({
            status: "error",
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
      moveCard: (from: CardLocation, to: CardLocation) => {
        const { board, path } = get();
        if (!board || !path) return;
        const nextBoard = moveCardDomain(board, from, to);
        set({ board: nextBoard });
        saveQueue.save(path, nextBoard);
      },
      retrySave: () => {
        const { board, path } = get();
        if (board && path) saveQueue.save(path, board);
      },
    };
  });
}
