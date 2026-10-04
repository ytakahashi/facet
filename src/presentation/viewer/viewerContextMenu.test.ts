import { describe, expect, it, vi } from "vitest";
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
      refresh,
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
      refresh: vi.fn(),
      copyText: vi.fn(),
      reveal: vi.fn(),
      moveToColumn: vi.fn(),
    });

    expect(entries[0]).toMatchObject({ enabled: false });
  });
});
