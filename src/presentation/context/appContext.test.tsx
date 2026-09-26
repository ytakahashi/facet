import { renderToStaticMarkup } from "react-dom/server";
import { create } from "zustand";
import { describe, expect, it } from "vitest";
import type { BoardState } from "../store/boardStore.ts";
import { createBoardViewStore } from "../store/boardViewStore.ts";
import type { FilterState } from "../store/filterStore.ts";
import type { MarkdownViewerState } from "../store/markdownViewerStore.ts";
import {
  BoardSessionProvider,
  useBoardStore,
  useBoardView,
  useFilterStore,
  useMarkdownViewer,
} from "./appContext.ts";
import type { BoardSession } from "./appContext.ts";

function makeSession(label: string): BoardSession {
  return {
    boardView: createBoardViewStore(),
    boardStore: create<BoardState>(
      () => ({ status: "empty", path: label } as BoardState),
    ),
    markdownViewer: create<MarkdownViewerState>(
      () => ({ status: "idle", selectedPath: label } as MarkdownViewerState),
    ),
    filterStore: create<FilterState>(
      () => ({ isSidebarOpen: label === "first" } as FilterState),
    ),
  };
}

function BoardStateProbe() {
  const boardPath = useBoardStore((state) => state.path);
  const selectedPath = useMarkdownViewer((state) => state.selectedPath);
  const sidebarOpen = useFilterStore((state) => state.isSidebarOpen);
  const view = useBoardView((state) => state.mode);
  return <span>{`${boardPath}/${selectedPath}/${sidebarOpen}/${view}`}</span>;
}

describe("BoardSessionProvider", () => {
  it("provides each board store from the nearest session", () => {
    const output = renderToStaticMarkup(
      <>
        <BoardSessionProvider value={makeSession("first")}>
          <BoardStateProbe />
        </BoardSessionProvider>
        <BoardSessionProvider value={makeSession("second")}>
          <BoardStateProbe />
        </BoardSessionProvider>
      </>,
    );

    expect(output).toBe(
      "<span>first/first/true/board</span><span>second/second/false/board</span>",
    );
  });

  it("rejects board hooks outside a board session", () => {
    expect(() => renderToStaticMarkup(<BoardStateProbe />)).toThrow(
      "useBoardSession must be used within a BoardSessionProvider",
    );
  });
});
