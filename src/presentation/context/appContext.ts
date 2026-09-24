import { createContext, useContext } from "react";
import type { StoreApi, UseBoundStore } from "zustand";
import type { Card } from "../../domain/card.ts";
import type { DirEntry } from "../../domain/fileSystemPort.ts";
import type { CardContentReadResult } from "../../usecase/readCardContents.ts";
import type { BoardState } from "../store/boardStore.ts";
import type { FilterState } from "../store/filterStore.ts";
import type { MarkdownViewerState } from "../store/markdownViewerStore.ts";
import type { NewBoardDialogState } from "../store/newBoardDialogStore.ts";
import type { PaneLayoutState } from "../store/paneLayoutStore.ts";
import type { RecentBoardsState } from "../store/recentBoardsStore.ts";
import type { WorkspaceState } from "../store/workspaceStore.ts";

export interface DirectoryBrowsing {
  listDirectory(path: string): Promise<DirEntry[]>;
  homeDirectory(): Promise<string>;
  createDirectory(parentDirectory: string, name: string): Promise<string>;
}

export interface CardContentReading {
  read(cards: readonly Card[]): Promise<CardContentReadResult[]>;
}

// App-wide services share one context: adding one requires a field and a hook,
// not another provider. Board-specific stores have their own context so a
// BoardSession can be supplied as a unit. Components use purpose-specific hooks.
export interface AppDependencies {
  cardContentReading: CardContentReading;
  directoryBrowsing: DirectoryBrowsing;
  newBoardDialog: UseBoundStore<StoreApi<NewBoardDialogState>>;
  paneLayout: UseBoundStore<StoreApi<PaneLayoutState>>;
  recentBoards: UseBoundStore<StoreApi<RecentBoardsState>>;
  workspace: UseBoundStore<StoreApi<WorkspaceState>>;
}

export interface BoardSession {
  boardStore: UseBoundStore<StoreApi<BoardState>>;
  markdownViewer: UseBoundStore<StoreApi<MarkdownViewerState>>;
  filterStore: UseBoundStore<StoreApi<FilterState>>;
}

const AppContext = createContext<AppDependencies | null>(null);
const BoardSessionContext = createContext<BoardSession | null>(null);

export const AppProvider = AppContext.Provider;
export const BoardSessionProvider = BoardSessionContext.Provider;

function useAppDependencies(): AppDependencies {
  const value = useContext(AppContext);
  if (!value) {
    throw new Error("useAppDependencies must be used within an AppProvider");
  }
  return value;
}

function useBoardSession(): BoardSession {
  const value = useContext(BoardSessionContext);
  if (!value) {
    throw new Error(
      "useBoardSession must be used within a BoardSessionProvider",
    );
  }
  return value;
}

export function useBoardStore<T>(selector: (state: BoardState) => T): T {
  return useBoardSession().boardStore(selector);
}

export function useCardContentReading(): CardContentReading {
  return useAppDependencies().cardContentReading;
}

export function useDirectoryBrowsing(): DirectoryBrowsing {
  return useAppDependencies().directoryBrowsing;
}

export function useFilterStore<T>(selector: (state: FilterState) => T): T {
  return useBoardSession().filterStore(selector);
}

export function useMarkdownViewer<T>(
  selector: (state: MarkdownViewerState) => T,
): T {
  return useBoardSession().markdownViewer(selector);
}

export function useNewBoardDialog<T>(
  selector: (state: NewBoardDialogState) => T,
): T {
  return useAppDependencies().newBoardDialog(selector);
}

export function usePaneLayout<T>(selector: (state: PaneLayoutState) => T): T {
  return useAppDependencies().paneLayout(selector);
}

export function useRecentBoards<T>(
  selector: (state: RecentBoardsState) => T,
): T {
  return useAppDependencies().recentBoards(selector);
}

export function useWorkspace<T>(selector: (state: WorkspaceState) => T): T {
  return useAppDependencies().workspace(selector);
}
