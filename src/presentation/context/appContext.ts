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

export interface DirectoryBrowsing {
  listDirectory(path: string): Promise<DirEntry[]>;
  homeDirectory(): Promise<string>;
  createDirectory(parentDirectory: string, name: string): Promise<string>;
}

export interface RecentBoards {
  list(): Promise<string[]>;
}

export interface CardContentReading {
  read(cards: readonly Card[]): Promise<CardContentReadResult[]>;
}

// One context for every service a component might need, instead of one
// context per service. Components still only see a narrow, purpose-specific
// hook (useBoardStore/useDirectoryBrowsing below) - this is just where those
// hooks get their value from - so adding a new service later is one field
// here plus one small hook, not another provider wrapped around <App />.
export interface AppDependencies {
  boardStore: UseBoundStore<StoreApi<BoardState>>;
  cardContentReading: CardContentReading;
  directoryBrowsing: DirectoryBrowsing;
  filterStore: UseBoundStore<StoreApi<FilterState>>;
  markdownViewer: UseBoundStore<StoreApi<MarkdownViewerState>>;
  newBoardDialog: UseBoundStore<StoreApi<NewBoardDialogState>>;
  paneLayout: UseBoundStore<StoreApi<PaneLayoutState>>;
  recentBoards: RecentBoards;
}

const AppContext = createContext<AppDependencies | null>(null);

export const AppProvider = AppContext.Provider;

function useAppDependencies(): AppDependencies {
  const value = useContext(AppContext);
  if (!value) {
    throw new Error("useAppDependencies must be used within an AppProvider");
  }
  return value;
}

export function useBoardStore<T>(selector: (state: BoardState) => T): T {
  return useAppDependencies().boardStore(selector);
}

export function useCardContentReading(): CardContentReading {
  return useAppDependencies().cardContentReading;
}

export function useDirectoryBrowsing(): DirectoryBrowsing {
  return useAppDependencies().directoryBrowsing;
}

export function useFilterStore<T>(selector: (state: FilterState) => T): T {
  return useAppDependencies().filterStore(selector);
}

export function useMarkdownViewer<T>(
  selector: (state: MarkdownViewerState) => T,
): T {
  return useAppDependencies().markdownViewer(selector);
}

export function useNewBoardDialog<T>(
  selector: (state: NewBoardDialogState) => T,
): T {
  return useAppDependencies().newBoardDialog(selector);
}

export function usePaneLayout<T>(selector: (state: PaneLayoutState) => T): T {
  return useAppDependencies().paneLayout(selector);
}

export function useRecentBoards(): RecentBoards {
  return useAppDependencies().recentBoards;
}
