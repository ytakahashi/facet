import { create } from "zustand";
import type { StoreApi, UseBoundStore } from "zustand";
import type {
  CardTableSort,
  CardTableSortKey,
} from "../../domain/cardTable.ts";

export type BoardViewMode = "board" | "table" | "directory";

export interface BoardViewState {
  mode: BoardViewMode;
  directoryExpansion: ReadonlyMap<string, boolean>;
  setDirectoryExpanded: (key: string, expanded: boolean) => void;
  tableSort: CardTableSort | undefined;
  setMode: (mode: BoardViewMode) => void;
  cycleTableSort: (key: CardTableSortKey) => void;
}

export function createBoardViewStore(): UseBoundStore<
  StoreApi<BoardViewState>
> {
  return create<BoardViewState>((set) => ({
    mode: "board",
    // Missing overrides follow whether the directory has card descendants.
    directoryExpansion: new Map(),
    setDirectoryExpanded: (key, expanded) =>
      set((state) => ({
        directoryExpansion: new Map(state.directoryExpansion).set(
          key,
          expanded,
        ),
      })),
    tableSort: undefined,
    setMode: (mode) => set({ mode }),
    cycleTableSort: (key) =>
      set((state) => ({
        tableSort:
          state.tableSort?.key !== key
            ? { key, direction: "asc" }
            : state.tableSort.direction === "asc"
              ? { key, direction: "desc" }
              : undefined,
      })),
  }));
}
