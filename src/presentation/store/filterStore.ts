import { create } from "zustand";
import type { StoreApi, UseBoundStore } from "zustand";
import {
  type CardFilterCriteria,
  EMPTY_CARD_FILTER,
} from "../../domain/cardFilter.ts";
import type { Priority } from "../../domain/priority.ts";

export interface FilterState {
  criteria: CardFilterCriteria;
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  toggleLabel: (name: string) => void;
  setPriority: (priority: Priority | undefined) => void;
  syncLabels: (validNames: ReadonlySet<string>) => void;
  clear: () => void;
}

export function createFilterStore(): UseBoundStore<StoreApi<FilterState>> {
  return create<FilterState>((set, get) => ({
    criteria: EMPTY_CARD_FILTER,
    isSidebarOpen: false,
    toggleSidebar: () =>
      set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
    toggleLabel: (name) => {
      const labels = new Set(get().criteria.labels);
      if (labels.has(name)) {
        labels.delete(name);
      } else {
        labels.add(name);
      }
      set((state) => ({ criteria: { ...state.criteria, labels } }));
    },
    setPriority: (priority) =>
      set((state) => ({ criteria: { ...state.criteria, priority } })),
    // A label the registry no longer has (renamed or deleted) is dropped
    // from the selection. Renaming updates every card's labels array too
    // (see renameLabelDefinition), so a stale name here would keep
    // matching zero cards - and from this side rename is indistinguishable
    // from delete, since only the resulting name set is visible. Carrying
    // selection through a rename would need the rename call site itself to
    // report the old/new name pair.
    syncLabels: (validNames) =>
      set((state) => {
        const labels = new Set(
          [...state.criteria.labels].filter((name) => validNames.has(name)),
        );
        return { criteria: { ...state.criteria, labels } };
      }),
    clear: () => set({ criteria: EMPTY_CARD_FILTER }),
  }));
}
