import { create } from "zustand";
import type { StoreApi, UseBoundStore } from "zustand";

export interface NewBoardDialogState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

// The dialog's visibility lives in a store rather than component state so it
// can be opened from outside the React tree as well (the composition layer
// wires native menu clicks to stores, the same way Open Recent reaches the
// board store).
export function createNewBoardDialogStore(): UseBoundStore<
  StoreApi<NewBoardDialogState>
> {
  return create<NewBoardDialogState>((set) => ({
    isOpen: false,
    open: () => set({ isOpen: true }),
    close: () => set({ isOpen: false }),
  }));
}
