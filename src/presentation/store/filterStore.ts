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
  setPriority: (priority: Priority | undefined) => void;
  clear: () => void;
}

export function createFilterStore(): UseBoundStore<StoreApi<FilterState>> {
  return create<FilterState>((set) => ({
    criteria: EMPTY_CARD_FILTER,
    isSidebarOpen: false,
    toggleSidebar: () =>
      set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
    setPriority: (priority) =>
      set((state) => ({ criteria: { ...state.criteria, priority } })),
    clear: () => set({ criteria: EMPTY_CARD_FILTER }),
  }));
}
