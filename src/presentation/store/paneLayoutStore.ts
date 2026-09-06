import { create } from "zustand";
import type { StoreApi, UseBoundStore } from "zustand";
import { DEFAULT_VIEWER_WIDTH } from "../components/viewerWidth.ts";

export type ViewerMode = "edit" | "preview";

// Viewer preferences live here rather than in markdownViewerStore: that store
// resets itself whenever the viewer closes, while layout and display choices
// have to outlive the card they were set on. Deliberately not persisted - they
// are a view of the window, not state about the app or the board.
export interface PaneLayoutState {
  viewerWidth: number;
  setViewerWidth: (width: number) => void;
  resetViewerWidth: () => void;
  viewerMode: ViewerMode;
  setViewerMode: (mode: ViewerMode) => void;
}

export function createPaneLayoutStore(): UseBoundStore<
  StoreApi<PaneLayoutState>
> {
  return create<PaneLayoutState>((set) => ({
    viewerWidth: DEFAULT_VIEWER_WIDTH,
    // Clamping belongs to the caller, which is the only side that knows how
    // wide the workspace is.
    setViewerWidth: (width) => set({ viewerWidth: width }),
    resetViewerWidth: () => set({ viewerWidth: DEFAULT_VIEWER_WIDTH }),
    viewerMode: "edit",
    setViewerMode: (mode) => set({ viewerMode: mode }),
  }));
}
