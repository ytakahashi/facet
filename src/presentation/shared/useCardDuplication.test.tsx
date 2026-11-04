import { renderToStaticMarkup } from "react-dom/server";
import { create } from "zustand";
import { describe, expect, it, vi } from "vite-plus/test";
import type { Card } from "../../domain/card.ts";
import { UseCaseError } from "../../usecase/useCaseError.ts";
import {
  AppProvider,
  BoardSessionProvider,
  type AppDependencies,
  type BoardSession,
} from "../context/appContext.ts";
import type { BoardState } from "../store/boardStore.ts";
import type { MarkdownViewerState } from "../store/markdownViewerStore.ts";
import { useCardDuplication } from "./useCardDuplication.ts";

// These context probes only exercise the services consumed by useCardDuplication.
function stub<T>(state: Partial<T>): T {
  return state as T;
}

type Actions = ReturnType<typeof useCardDuplication>;
function Probe({ capture }: { capture: (actions: Actions) => void }) {
  capture(useCardDuplication());
  return null;
}

function setup() {
  const duplicateCard = vi
    .fn<BoardState["duplicateCard"]>()
    .mockResolvedValue(undefined);
  const boardStore = create<BoardState>(() =>
    stub<BoardState>({ duplicateCard }),
  );
  const markdownViewer = create<MarkdownViewerState>(() =>
    stub<MarkdownViewerState>({ savingPaths: new Set<string>() }),
  );
  const showAlert = vi.fn();
  const capture = vi.fn<(actions: Actions) => void>();
  renderToStaticMarkup(
    <AppProvider value={stub<AppDependencies>({ showAlert })}>
      <BoardSessionProvider
        value={{ boardStore, markdownViewer } as BoardSession}
      >
        <Probe capture={capture} />
      </BoardSessionProvider>
    </AppProvider>,
  );
  return {
    actions: capture.mock.calls[0][0],
    duplicateCard,
    markdownViewer,
    showAlert,
  };
}

const card: Card = {
  path: "a.md",
  absolutePath: "/board/a.md",
  fileState: "available",
  displayTitle: "A",
  labels: [],
};

describe("useCardDuplication", () => {
  it("reads saving state when opening a menu without requiring another render", () => {
    const { actions, markdownViewer } = setup();
    expect(actions.canDuplicateCard(card)).toBe(true);
    markdownViewer.setState({ savingPaths: new Set(["a.md"]) });
    expect(actions.canDuplicateCard(card)).toBe(false);
    markdownViewer.setState({ savingPaths: new Set(["b.md"]) });
    expect(actions.canDuplicateCard(card)).toBe(true);
  });

  it("delegates selection to the session and reports failures", async () => {
    const { actions, duplicateCard, showAlert } = setup();
    duplicateCard.mockRejectedValue(new UseCaseError("card.save-in-progress"));
    actions.duplicateCard("a.md");
    expect(duplicateCard).toHaveBeenCalledExactlyOnceWith("a.md");
    await vi.waitFor(() => expect(showAlert).toHaveBeenCalledOnce());
  });
});
