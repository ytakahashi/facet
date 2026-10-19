import { describe, expect, it, vi } from "vite-plus/test";
import type { Board } from "../../domain/board.ts";
import { buildFileContextMenu } from "./fileContextMenu.ts";

const board: Board = {
  version: 1,
  name: "Test",
  labels: [],
  columns: [
    { id: "todo", name: "To do", cards: [] },
    { id: "done", name: "Done", cards: [] },
  ],
};

describe("file context menu", () => {
  it("offers columns in board order and passes the selected id", () => {
    const add = vi.fn();
    const [menu] = buildFileContextMenu(board, false, add);
    expect(menu.kind).toBe("submenu");
    if (menu.kind !== "submenu") throw new Error("Expected submenu");
    expect(menu.label).toBe("Add to Board");
    expect(
      menu.entries.map(
        (entry) => entry.kind === "item" && [entry.label, entry.enabled],
      ),
    ).toEqual([
      ["To do", true],
      ["Done", true],
    ]);
    for (const entry of menu.entries)
      if (entry.kind === "item") entry.onSelect();
    expect(add.mock.calls).toEqual([["todo"], ["done"]]);
  });

  it("disables adding while pending and explains a board without columns", () => {
    const [pending] = buildFileContextMenu(board, true, vi.fn());
    if (pending.kind !== "submenu") throw new Error("Expected submenu");
    expect(
      pending.entries.every((entry) => entry.kind === "item" && !entry.enabled),
    ).toBe(true);
    const [empty] = buildFileContextMenu(
      { ...board, columns: [] },
      false,
      vi.fn(),
    );
    if (empty.kind !== "submenu") throw new Error("Expected submenu");
    expect(empty.entries).toMatchObject([
      { label: "No columns", enabled: false },
    ]);
  });
});
