import { create } from "zustand";
import type { StoreApi, UseBoundStore } from "zustand";
import type { CreateBoardInput } from "../../usecase/createBoard.ts";
import type { BoardSession } from "../context/appContext.ts";

export interface BoardTab {
  id: string;
  path: string;
  session: BoardSession;
}

export interface WorkspaceState {
  tabs: readonly BoardTab[];
  activeTabId?: string;
  openBoard: (path: string) => void;
  createBoard: (input: CreateBoardInput) => Promise<void>;
  activateTab: (id: string) => void;
  showStartScreen: () => void;
  closeTab: (id: string) => boolean;
}

export interface WorkspaceStoreDeps {
  createSession: () => BoardSession;
  confirmCloseBoard: () => boolean;
}

export function createWorkspaceStore({
  createSession,
  confirmCloseBoard,
}: WorkspaceStoreDeps): UseBoundStore<StoreApi<WorkspaceState>> {
  let nextTabId = 0;

  return create<WorkspaceState>((set, get) => ({
    tabs: [],
    activeTabId: undefined,
    openBoard: (path) => {
      const existing = get().tabs.find((tab) => tab.path === path);
      if (existing) {
        set({ activeTabId: existing.id });
        // An explicit open retries a failed load; merely selecting the tab
        // leaves its error visible until the user asks to open it again.
        if (existing.session.boardStore.getState().status === "error") {
          void existing.session.boardStore.getState().openBoard(path);
        }
        return;
      }

      const session = createSession();
      const tab = { id: String(++nextTabId), path, session };
      // Register before starting I/O so a second open can reuse a loading tab.
      set((state) => ({
        tabs: [...state.tabs, tab],
        activeTabId: tab.id,
      }));
      void session.boardStore.getState().openBoard(path);
    },
    createBoard: async (input) => {
      const session = createSession();
      // Creation failures stay in the dialog. A read-back failure still has a
      // created file, so the store returns its path and the error gets a tab.
      const path = await session.boardStore.getState().createBoard(input);
      const tab = { id: String(++nextTabId), path, session };
      set((state) => ({
        tabs: [...state.tabs, tab],
        activeTabId: tab.id,
      }));
    },
    activateTab: (id) => {
      if (get().tabs.some((tab) => tab.id === id)) {
        set({ activeTabId: id });
      }
    },
    showStartScreen: () => set({ activeTabId: undefined }),
    closeTab: (id) => {
      const { tabs, activeTabId } = get();
      const index = tabs.findIndex((tab) => tab.id === id);
      if (index === -1) return false;
      const tab = tabs[index];
      const boardState = tab.session.boardStore.getState();
      if (
        (boardState.isSaving || boardState.saveError !== undefined ||
          boardState.saveConflict) && !confirmCloseBoard()
      ) return false;
      // close() clears the viewer. Keep it last so declining either prompt
      // leaves the entire tab unchanged.
      if (!tab.session.markdownViewer.getState().close()) return false;

      const remaining = tabs.filter((entry) => entry.id !== id);
      const nextActiveTabId = activeTabId === id
        ? (remaining[index] ?? remaining[index - 1])?.id
        : activeTabId;
      set({ tabs: remaining, activeTabId: nextActiveTabId });
      return true;
    },
  }));
}
