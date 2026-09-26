import { create } from "zustand";
import type { StoreApi, UseBoundStore } from "zustand";
import type {
  CardTableSort,
  CardTableSortKey,
} from "../../domain/cardTable.ts";

export type BoardViewMode = "board" | "table";

export interface BoardViewState {
  mode: BoardViewMode;
  tableSort: CardTableSort | undefined;
  setMode: (mode: BoardViewMode) => void;
  cycleTableSort: (key: CardTableSortKey) => void;
}

export function createBoardViewStore(): UseBoundStore<
  StoreApi<BoardViewState>
> {
  return create<BoardViewState>((set) => ({
    mode: "board",
    tableSort: undefined,
    setMode: (mode) => set({ mode }),
    cycleTableSort: (key) =>
      set((state) => ({
        tableSort: state.tableSort?.key !== key
          ? { key, direction: "asc" }
          : state.tableSort.direction === "asc"
          ? { key, direction: "desc" }
          : undefined,
      })),
  }));
}
