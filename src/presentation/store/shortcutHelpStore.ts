import { create } from "zustand";
import type { StoreApi, UseBoundStore } from "zustand";

export interface ShortcutHelpState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

// A store rather than component state so the help can be opened from outside
// the React tree too: a native Help menu item would only need composition to
// call open(), the same way New Board reaches newBoardDialogStore.
export function createShortcutHelpStore(): UseBoundStore<
  StoreApi<ShortcutHelpState>
> {
  return create<ShortcutHelpState>((set) => ({
    isOpen: false,
    open: () => set({ isOpen: true }),
    close: () => set({ isOpen: false }),
  }));
}
