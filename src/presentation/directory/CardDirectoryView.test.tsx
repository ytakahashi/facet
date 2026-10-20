import { renderToStaticMarkup } from "react-dom/server";
import { create } from "zustand";
import { describe, expect, it, vi } from "vite-plus/test";
import type { Board } from "../../domain/board.ts";
import { AppProvider, BoardSessionProvider } from "../context/appContext.ts";
import type { AppDependencies, BoardSession } from "../context/appContext.ts";
import type { BoardState } from "../store/boardStore.ts";
import { createBoardViewStore } from "../store/boardViewStore.ts";
import { createDirectoryStore } from "../store/directoryStore.ts";
import { createFilterStore } from "../store/filterStore.ts";
import type { MarkdownViewerState } from "../store/markdownViewerStore.ts";
import { CardDirectoryView } from "./CardDirectoryView.tsx";

function makeSession(): BoardSession {
  return {
    boardStore: create<BoardState>(
      () => ({ status: "loaded", path: "/board/board.yaml" }) as BoardState,
    ),
    fileAddition: create(() => ({
      additions: new Map(),
      addFile: async () => {},
      clearFailures: () => {},
    })),
    directoryStore: createDirectoryStore(async () => []),
    boardView: createBoardViewStore(),
    filterStore: createFilterStore(),
    markdownViewer: create<MarkdownViewerState>(
      () =>
        ({
          selectedPath: "docs/missing.md",
          selectCard: vi.fn(),
        }) as unknown as MarkdownViewerState,
    ),
  };
}

function markup(board: Board, session = makeSession()): string {
  // Server rendering reads Zustand's initial snapshot, not subsequent updates.
  const snapshot: BoardSession = {
    ...session,
    boardView: create(() => session.boardView.getState()),
    directoryStore: create(() => session.directoryStore.getState()),
    fileAddition: create(() => session.fileAddition.getState()),
    filterStore: create(() => session.filterStore.getState()),
  };
  const dependencies = {
    clipboard: { copyText: vi.fn() },
    finder: { reveal: vi.fn() },
    showAlert: vi.fn(),
    contextMenu: { show: vi.fn() },
  } as unknown as AppDependencies;
  return renderToStaticMarkup(
    <AppProvider value={dependencies}>
      <BoardSessionProvider value={snapshot}>
        <CardDirectoryView
          board={board}
          onDeleteCard={vi.fn()}
          onRepairCard={vi.fn()}
          onCardContextMenu={vi.fn()}
        />
      </BoardSessionProvider>
    </AppProvider>,
  );
}

const board: Board = {
  version: 1,
  name: "Test",
  labels: [{ name: "bug", color: "ruby" }],
  columns: [
    {
      id: "todo",
      name: "To do",
      cards: [
        {
          path: "docs/missing.md",
          displayTitle: "Broken task",
          fileState: "missing",
          labels: ["bug"],
        },
        {
          path: "docs/design/ready.md",
          displayTitle: "ready",
          fileState: "available",
          labels: [],
        },
        {
          path: "../outside.md",
          displayTitle: "Outside task",
          fileState: "unresolvable",
          labels: [],
        },
      ],
    },
  ],
};

describe("CardDirectoryView", () => {
  it("shows addition progress and errors beside the unregistered file", () => {
    const session = makeSession();
    session.directoryStore.setState({
      snapshots: new Map([["", [{ name: "notes.md", isDirectory: false }]]]),
      scans: new Map([["", { status: "scanned" }]]),
    });
    session.fileAddition.setState({
      additions: new Map([["notes.md", { status: "adding" }]]),
    });
    expect(markup({ ...board, columns: [] }, session)).toContain("Adding…");
    expect(markup({ ...board, columns: [] }, session)).toContain(
      'aria-busy="true"',
    );
    session.fileAddition.setState({
      additions: new Map([
        ["notes.md", { status: "failed", message: "Cannot add file" }],
      ]),
    });
    const output = markup({ ...board, columns: [] }, session);
    expect(output).toContain("Cannot add file");
    expect(output).toContain("notes.md");
    expect(output).not.toContain("card-directory__open");
  });
  it("shows unregistered files without viewer controls and keeps FS-only directories collapsed", () => {
    const session = makeSession();
    session.directoryStore.setState({
      snapshots: new Map([
        [
          "",
          [
            { name: "empty", isDirectory: true },
            { name: "notes.MD", isDirectory: false },
          ],
        ],
        ["empty", [{ name: "hidden-child.md", isDirectory: false }]],
      ]),
      scans: new Map([["", { status: "scanned" }]]),
    });
    const output = markup({ ...board, columns: [] }, session);
    expect(output).toContain("notes.MD");
    expect(output).toContain("Not on board");
    expect(output).toContain('aria-expanded="false"');
    expect(output).not.toContain("hidden-child.md");
    expect(output).not.toContain("card-directory__open");
    expect(output).not.toContain("No Markdown files or directories.");
  });

  it("shows root and branch failures alongside cards without an empty-state message", () => {
    const session = makeSession();
    session.directoryStore.setState({
      scans: new Map([
        ["", { status: "failed", message: "Root unavailable" }],
        ["docs", { status: "failed", message: "Branch unavailable" }],
      ]),
    });
    const output = markup(board, session);
    expect(output).toContain("Root unavailable");
    expect(output).toContain("Branch unavailable");
    expect(output).toContain("Retry");
    expect(output).toContain("missing.md");
    expect(output).toContain("ready.md");
    expect(output).not.toContain("No Markdown files or directories.");
    expect(markup({ ...board, columns: [] }, session)).not.toContain(
      "No Markdown files or directories.",
    );
  });

  it("renders nested disclosure lists, metadata and the selected broken card", () => {
    const output = markup(board);
    expect(output).toContain('aria-label="Files"');
    expect(output).toMatch(/aria-expanded="true"/);
    expect(output).toMatch(/docs<\/button>.*?<ul>/);
    expect(output).toMatch(/design<\/button>.*?<ul>/);
    expect(output).toContain('class="card-directory__name">missing.md</span>');
    expect(output).toContain(
      'class="card-directory__subtitle">Broken task</span>',
    );
    expect(output).not.toContain(
      'class="card-directory__subtitle">ready</span>',
    );
    expect(output).toContain('class="card-directory__column">To do</span>');
    expect(output).toContain("card__label--ruby");
    expect(output).toContain("card-directory__row--selected");
    expect(output).toContain('aria-current="true"');
    expect(output).toContain('title="No file at this path."');
    expect(output).toContain('aria-label="Delete Broken task"');
  });

  it("hides collapsed descendants without reporting a filter-empty state", () => {
    const session = makeSession();
    session.boardView.getState().setDirectoryExpanded("docs", false);
    const output = markup(board, session);
    expect(output).toContain('aria-expanded="false"');
    expect(output).not.toContain("missing.md");
    expect(output).not.toContain("ready.md");
    expect(output).toContain("outside.md");
    const insideOnly = {
      ...board,
      columns: [
        { ...board.columns[0], cards: board.columns[0].cards.slice(0, 2) },
      ],
    };
    expect(markup(insideOnly, session)).not.toContain(
      "No cards match the filter.",
    );
  });

  it("renders outside cards after the directory tree", () => {
    const output = markup(board);
    expect(output).toContain('aria-label="Outside board directory"');
    expect(output.indexOf("Outside board directory")).toBeGreaterThan(
      output.indexOf("missing.md"),
    );
    expect(output).toContain('title="../outside.md"');
  });

  it("distinguishes an empty board from filtered-out cards and prunes the outside group", () => {
    expect(markup({ ...board, columns: [] })).toContain("Loading files…");
    const scanned = makeSession();
    scanned.directoryStore.setState({
      scans: new Map([["", { status: "scanned" }]]),
    });
    expect(markup({ ...board, columns: [] }, scanned)).toContain(
      "No Markdown files or directories.",
    );
    const session = makeSession();
    session.filterStore.setState({
      criteria: { labels: new Set(), hiddenColumnIds: new Set(["todo"]) },
    });
    const output = markup(board, session);
    expect(output).toContain("No cards match the filter.");
    expect(output).not.toContain("Outside board directory");
    expect(output).not.toContain("aria-expanded");
  });
});
