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
  toggleColumnVisibility: (columnId: string) => void;
  setPriority: (priority: Priority | undefined) => void;
  syncLabels: (validNames: ReadonlySet<string>) => void;
  clear: () => void;
}

export function createFilterStore(): UseBoundStore<StoreApi<FilterState>> {
  return create<FilterState>((set) => ({
    criteria: EMPTY_CARD_FILTER,
    isSidebarOpen: false,
    toggleSidebar: () =>
      set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
    toggleLabel: (name) =>
      set((state) => ({
        criteria: {
          ...state.criteria,
          labels: withToggled(state.criteria.labels, name),
        },
      })),
    // The checkbox toggles visibility while the criteria stores the hidden
    // ids, so the two are inverses of each other (see cardFilter.ts for why
    // hidden ids are what gets stored).
    toggleColumnVisibility: (columnId) =>
      set((state) => ({
        criteria: {
          ...state.criteria,
          hiddenColumnIds: withToggled(
            state.criteria.hiddenColumnIds,
            columnId,
          ),
        },
      })),
    setPriority: (priority) =>
      set((state) => ({ criteria: { ...state.criteria, priority } })),
    // A label the registry no longer has (renamed or deleted) is dropped
    // from the selection. Renaming updates every card's labels array too
    // (see renameLabelDefinition), so a stale name here would keep
    // matching zero cards - and from this side rename is indistinguishable
    // from delete, since only the resulting name set is visible. Carrying
    // selection through a rename would need the rename call site itself to
    // report the old/new name pair.
    //
    // Hidden column ids need no such sync: a column id is never reused, and
    // an id whose column is gone hides nothing (isCardFilterActive ignores
    // it), while board.columns changes identity on every card move - an
    // effect watching it would re-run for every board edit.
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

function withToggled(
  values: ReadonlySet<string>,
  value: string,
): ReadonlySet<string> {
  const next = new Set(values);
  if (!next.delete(value)) next.add(value);
  return next;
}
