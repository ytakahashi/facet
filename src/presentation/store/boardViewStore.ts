import { create } from "zustand";
import type { StoreApi, UseBoundStore } from "zustand";
import type {
  CardTableSort,
  CardTableSortKey,
} from "../../domain/cardTable.ts";

export type BoardViewMode = "board" | "table" | "directory";

export interface BoardViewState {
  mode: BoardViewMode;
  collapsedDirectories: ReadonlySet<string>;
  toggleDirectory: (key: string) => void;
  tableSort: CardTableSort | undefined;
  setMode: (mode: BoardViewMode) => void;
  cycleTableSort: (key: CardTableSortKey) => void;
}

export function createBoardViewStore(): UseBoundStore<
  StoreApi<BoardViewState>
> {
  return create<BoardViewState>((set) => ({
    mode: "board",
    // Remember collapsed nodes so newly introduced directories start open.
    collapsedDirectories: new Set(),
    toggleDirectory: (key) =>
      set((state) => {
        const collapsedDirectories = new Set(state.collapsedDirectories);
        if (!collapsedDirectories.delete(key)) collapsedDirectories.add(key);
        return { collapsedDirectories };
      }),
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
