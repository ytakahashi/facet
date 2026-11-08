import { describe, expect, it, vi } from "vite-plus/test";
import type { Board } from "../../domain/board.ts";
import type { Card } from "../../domain/card.ts";
import { buildViewerContextMenu } from "./viewerContextMenu.ts";

const card: Card = {
  path: "card.md",
  absolutePath: "/board/card.md",
  displayTitle: "Card",
  fileState: "available",
  labels: [],
};
const board: Board = {
  version: 1,
  name: "Board",
  labels: [],
  columns: [{ id: "todo", name: "Todo", cards: [card] }],
};

describe("buildViewerContextMenu", () => {
  it("prepends Reload Markdown and invokes refresh", () => {
    const refresh = vi.fn();
    const entries = buildViewerContextMenu(card, board, true, {
      canCopySelection: false,
      refresh,
      duplicateCard: vi.fn(),
      canDuplicateCard: true,
      copyText: vi.fn(),
      reveal: vi.fn(),
      moveToColumn: vi.fn(),
    });

    expect(entries[0]).toMatchObject({
      kind: "item",
      label: "Reload Markdown",
      enabled: true,
    });
    expect(entries[1]).toEqual({ kind: "separator" });
    expect(entries[2]).toMatchObject({ kind: "item", label: "Copy Path" });
    if (entries[0].kind !== "item") throw new Error("no reload item");
    entries[0].onSelect();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("disables Reload Markdown when refreshing is unavailable", () => {
    const entries = buildViewerContextMenu(card, board, false, {
      canCopySelection: false,
      refresh: vi.fn(),
      duplicateCard: vi.fn(),
      canDuplicateCard: true,
      copyText: vi.fn(),
      reveal: vi.fn(),
      moveToColumn: vi.fn(),
    });

    expect(entries[0]).toMatchObject({ enabled: false });
  });

  it("leads with Copy when the selection can be copied", () => {
    const entries = buildViewerContextMenu(card, board, true, {
      canCopySelection: true,
      refresh: vi.fn(),
      duplicateCard: vi.fn(),
      canDuplicateCard: true,
      copyText: vi.fn(),
      reveal: vi.fn(),
      moveToColumn: vi.fn(),
    });

    expect(entries.slice(0, 3)).toMatchObject([
      { kind: "copy" },
      { kind: "separator" },
      { kind: "item", label: "Reload Markdown" },
    ]);
  });
});
