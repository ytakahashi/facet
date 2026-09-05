import { create } from "zustand";
import type { StoreApi, UseBoundStore } from "zustand";
import { DEFAULT_VIEWER_WIDTH } from "../components/viewerWidth.ts";

// The Markdown viewer's width lives here rather than in markdownViewerStore:
// that store resets itself whenever the viewer closes, and the width has to
// outlive the card it was set on. Deliberately not persisted - it is a view
// of the window, not state about the app or the board.
export interface PaneLayoutState {
  viewerWidth: number;
  setViewerWidth: (width: number) => void;
  resetViewerWidth: () => void;
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
  }));
}
