import { describe, expect, it, vi } from "vitest";
import type { ContextMenuEntry } from "../context/appContext.ts";
import { buildBoardContextMenu } from "./boardContextMenus.ts";

function select(entries: ContextMenuEntry[], label: string): void {
  const entry = entries.find((candidate) =>
    candidate.kind === "item" && candidate.label === label
  );
  if (entry?.kind !== "item") throw new Error(`no item labelled ${label}`);
  entry.onSelect();
}

describe("buildBoardContextMenu", () => {
  it("reloads, copies, and reveals the board file path", () => {
    const copyText = vi.fn();
    const reveal = vi.fn();
    const refresh = vi.fn();
    const entries = buildBoardContextMenu("/board/board.yaml", true, {
      copyText,
      reveal,
      refresh,
    });

    expect(entries.map((entry) => entry.kind === "item" && entry.label))
      .toEqual([
        "Reload Board",
        false,
        "Copy Board File Path",
        "Reveal in Finder",
      ]);
    select(entries, "Reload Board");
    select(entries, "Copy Board File Path");
    select(entries, "Reveal in Finder");
    expect(refresh).toHaveBeenCalledOnce();
    expect(copyText).toHaveBeenCalledWith("/board/board.yaml");
    expect(reveal).toHaveBeenCalledWith("/board/board.yaml");
  });

  it("disables reload when the board cannot be refreshed", () => {
    const entries = buildBoardContextMenu("/board/board.yaml", false, {
      copyText: vi.fn(),
      reveal: vi.fn(),
      refresh: vi.fn(),
    });

    expect(entries[0]).toMatchObject({ label: "Reload Board", enabled: false });
  });
});
