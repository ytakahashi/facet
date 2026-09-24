import { create } from "zustand";
import type { StoreApi, UseBoundStore } from "zustand";
import type { RecentBoardEntry } from "../../usecase/listRecentBoardEntries.ts";
import type { UiError } from "../errors/toUiError.ts";
import { toUiError } from "../errors/toUiError.ts";

export interface RecentBoardsDeps {
  list: () => Promise<RecentBoardEntry[]>;
  remove: (path: string) => Promise<void>;
}

export interface RecentBoardsState {
  entries: RecentBoardEntry[];
  error?: UiError;
  load: () => Promise<void>;
  remove: (path: string) => Promise<void>;
}

export function createRecentBoardsStore(
  deps: RecentBoardsDeps,
): UseBoundStore<StoreApi<RecentBoardsState>> {
  // Only the latest request may write entries. A load that read the config
  // before a removal was saved would otherwise bring the removed board back,
  // so a removal also invalidates every load already in flight.
  let latestRequest = 0;

  return create<RecentBoardsState>((set, get) => ({
    entries: [],
    error: undefined,
    load: async () => {
      const request = ++latestRequest;
      try {
        const entries = await deps.list();
        if (request === latestRequest) set({ entries, error: undefined });
      } catch (error) {
        if (request === latestRequest) set({ error: toUiError(error) });
      }
    },
    remove: async (path) => {
      try {
        await deps.remove(path);
      } catch (error) {
        set({ error: toUiError(error) });
        return;
      }
      latestRequest++;
      set({
        entries: get().entries.filter((entry) => entry.path !== path),
        error: undefined,
      });
    },
  }));
}
