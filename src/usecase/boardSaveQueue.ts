import type { Board } from "../domain/board.ts";

export type SaveBoard = (path: string, board: Board) => Promise<void>;

export interface BoardSaveQueueCallbacks {
  onSaving: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
}

export interface BoardSaveQueue {
  save(path: string, board: Board): void;
}

// Coalesces overlapping save requests for the same board file. A request
// that arrives while a previous one is still in flight isn't run inline
// (that would serialize callers behind disk I/O) - it replaces whatever was
// already queued and runs once the in-flight save settles. This guarantees
// the file always ends up matching the most recently requested board,
// regardless of how requests overlap or how long each save takes.
export function createBoardSaveQueue(
  saveBoard: SaveBoard,
  callbacks: BoardSaveQueueCallbacks,
): BoardSaveQueue {
  let isSaving = false;
  let pending: { path: string; board: Board } | undefined;

  const run = async (path: string, board: Board) => {
    isSaving = true;
    callbacks.onSaving();
    try {
      await saveBoard(path, board);
      callbacks.onSaved();
    } catch (error) {
      callbacks.onError(error instanceof Error ? error.message : String(error));
    } finally {
      isSaving = false;
      if (pending) {
        const next = pending;
        pending = undefined;
        void run(next.path, next.board);
      }
    }
  };

  return {
    save(path: string, board: Board) {
      if (isSaving) {
        pending = { path, board };
        return;
      }
      void run(path, board);
    },
  };
}
