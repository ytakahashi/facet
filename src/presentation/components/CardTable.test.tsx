import { renderToStaticMarkup } from "react-dom/server";
import { create } from "zustand";
import { describe, expect, it, vi } from "vitest";
import type { Board } from "../../domain/board.ts";
import { BoardSessionProvider } from "../context/appContext.ts";
import type { BoardSession } from "../context/appContext.ts";
import type { BoardState } from "../store/boardStore.ts";
import { createBoardViewStore } from "../store/boardViewStore.ts";
import type { BoardViewState } from "../store/boardViewStore.ts";
import { createFilterStore } from "../store/filterStore.ts";
import type { FilterState } from "../store/filterStore.ts";
import type { MarkdownViewerState } from "../store/markdownViewerStore.ts";
import type { CardTableSort } from "../../domain/cardTable.ts";
import { CardTable } from "./CardTable.tsx";

function makeSession(options: {
  sort?: CardTableSort;
  hiddenColumnIds?: ReadonlySet<string>;
} = {}): BoardSession {
  return {
    boardStore: create<BoardState>(() => ({ status: "loaded" } as BoardState)),
    boardView: create<BoardViewState>(() => ({
      ...createBoardViewStore().getState(),
      tableSort: options.sort,
    })),
    filterStore: create<FilterState>(() => ({
      ...createFilterStore().getState(),
      criteria: {
        labels: new Set(),
        hiddenColumnIds: options.hiddenColumnIds ?? new Set(),
      },
    })),
    markdownViewer: create<MarkdownViewerState>(() => ({
      selectedPath: "missing.md",
      selectCard: vi.fn(),
    } as unknown as MarkdownViewerState)),
  };
}

function markup(board: Board, session = makeSession()): string {
  return renderToStaticMarkup(
    <BoardSessionProvider value={session}>
      <CardTable
        board={board}
        onDeleteCard={vi.fn()}
        onRepairCard={vi.fn()}
      />
    </BoardSessionProvider>,
  );
}

const board: Board = {
  version: 1,
  name: "Test",
  labels: [{ name: "bug", color: "ruby" }],
  columns: [{
    id: "todo",
    name: "To do",
    cards: [
      {
        path: "missing.md",
        displayTitle: "Zeta",
        fileState: "missing",
        labels: ["bug"],
        priority: "high",
      },
      {
        path: "available.md",
        displayTitle: "Alpha",
        fileState: "available",
        labels: [],
      },
    ],
  }],
};

describe("CardTable", () => {
  it("renders a semantic table in fixed column order and marks the active sort", () => {
    const session = makeSession({ sort: { key: "title", direction: "asc" } });
    const output = markup(board, session);

    expect(output).toContain("<table>");
    expect(output).toMatch(
      /<th[^>]*aria-sort="ascending"[^>]*><button[^>]*>Title/,
    );
    expect(output).toMatch(/<th[^>]*aria-sort="none"[^>]*><button[^>]*>Labels/);
    expect(output.indexOf(">Alpha</button>")).toBeLessThan(
      output.indexOf(">Zeta</button>"),
    );
    expect(output.indexOf(">Labels</button>")).toBeLessThan(
      output.indexOf(">Column</button>"),
    );
  });

  it("shows the selected broken card with the shared hint and labels", () => {
    const output = markup(board);

    expect(output).toContain("card-table__row--selected");
    expect(output).toContain("Missing</span>");
    expect(output).toContain("No file at this path.");
    expect(output).toContain("card__label--ruby");
    expect(output).toContain("card__priority--high");
    expect(output).toContain('aria-label="Delete Zeta"');
  });

  it("distinguishes an empty board from a filter hiding every card", () => {
    const empty = { ...board, columns: [{ ...board.columns[0], cards: [] }] };
    expect(markup(empty)).toContain(
      "No cards yet. Add cards from the Board view.",
    );

    const session = makeSession({ hiddenColumnIds: new Set(["todo"]) });
    expect(markup(board, session)).toContain("No cards match the filter.");
  });
});
