import { create } from "zustand";
import type { StoreApi } from "zustand";
import {
  canonicalCardPath,
  directoryOf,
  resolveCardPath,
} from "../../domain/boardPath.ts";
import { UseCaseError } from "../../usecase/useCaseError.ts";
import { toUiError } from "../errors/toUiError.ts";
import type { BoardState } from "./boardStore.ts";

export type FileAddition =
  | { status: "adding" }
  | { status: "failed"; message: string };

export interface FileAdditionState {
  // Keyed by canonicalCardPath of the board-relative path.
  additions: ReadonlyMap<string, FileAddition>;
  addFile: (boardPath: string, path: string, columnId: string) => Promise<void>;
  clearFailures: () => void;
}

export function createFileAdditionStore(boardStore: StoreApi<BoardState>) {
  return create<FileAdditionState>((set, get) => ({
    additions: new Map(),
    addFile: async (boardPath, path, columnId) => {
      const key = canonicalCardPath(path);
      if (get().additions.get(key)?.status === "adding") return;
      set({
        additions: new Map(get().additions).set(key, { status: "adding" }),
      });
      try {
        // Native menus can outlive the board and columns they were opened for.
        if (boardStore.getState().path !== boardPath)
          throw new UseCaseError("card.board-changed");
        const resolved = resolveCardPath(directoryOf(boardPath) || "/", path);
        if (!resolved.ok)
          throw new Error("File path must resolve inside the board");
        await boardStore
          .getState()
          .addExistingCard({ absolutePath: resolved.absolutePath, columnId });
        const additions = new Map(get().additions);
        additions.delete(key);
        set({ additions });
      } catch (error) {
        set({
          additions: new Map(get().additions).set(key, {
            status: "failed",
            message: toUiError(error).message,
          }),
        });
      }
    },
    clearFailures: () => {
      const additions = new Map(
        [...get().additions].filter(
          ([, addition]) => addition.status !== "failed",
        ),
      );
      if (additions.size !== get().additions.size) set({ additions });
    },
  }));
}
