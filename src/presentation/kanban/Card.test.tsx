import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vite-plus/test";
import { create } from "zustand";
import {
  type BoardSession,
  BoardSessionProvider,
} from "../context/appContext.ts";
import type { BoardState } from "../store/boardStore.ts";
import { createBoardViewStore } from "../store/boardViewStore.ts";
import { createDirectoryStore } from "../store/directoryStore.ts";
import { createFileAdditionStore } from "../store/fileAdditionStore.ts";
import { createFilterStore } from "../store/filterStore.ts";
import { createMarkdownViewerStore } from "../store/markdownViewerStore.ts";
import { Card } from "./Card.tsx";

it("places all card content before the menu in Tab order", () => {
  const boardStore = create<BoardState>(
    () => ({ status: "empty" }) as BoardState,
  );
  const session: BoardSession = {
    boardStore,
    fileAddition: createFileAdditionStore(boardStore),
    directoryStore: createDirectoryStore(async () => []),
    boardView: createBoardViewStore(),
    filterStore: createFilterStore(),
    markdownViewer: createMarkdownViewerStore(
      async () => ({ content: "", revision: "revision-1" }),
      async () => "revision-2",
      async () => false,
      async () => false,
    ),
  };
  const output = renderToStaticMarkup(
    <BoardSessionProvider value={session}>
      <Card
        card={{
          path: "draft.md",
          displayTitle: "Draft",
          fileState: "missing",
          labels: ["Work"],
        }}
        columnId="todo"
        index={0}
        labelDisplay={{ positions: new Map(), colors: new Map() }}
        onDelete={vi.fn()}
        onRepair={vi.fn()}
        onCardContextMenu={vi.fn()}
        onOpenCardMenu={vi.fn()}
      />
    </BoardSessionProvider>,
  );

  expect(output).toMatch(
    /class="card__missing".*class="card__title".*class="card__labels".*class="card__menu".*class="card__delete"/,
  );
});
