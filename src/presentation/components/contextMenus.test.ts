import { describe, expect, it, vi } from "vitest";
import type { ContextMenuEntry } from "../context/appContext.ts";
import type { Board } from "../../domain/board.ts";
import type { Card } from "../../domain/card.ts";
import {
  buildCardContextMenu,
  buildColumnContextMenu,
} from "./contextMenus.ts";

function select(entries: ContextMenuEntry[], label: string): void {
  const entry = entries.find((candidate) =>
    candidate.kind === "item" && candidate.label === label
  );
  if (entry?.kind !== "item") throw new Error(`no item labelled ${label}`);
  entry.onSelect();
}

describe("buildColumnContextMenu", () => {
  it("offers adding a card and renaming the column, both enabled", () => {
    const entries = buildColumnContextMenu({
      addCard: vi.fn(),
      rename: vi.fn(),
    });

    expect(entries.map((entry) => entry.kind === "item" && entry.enabled))
      .toEqual([true, true]);
  });

  it("routes each item to its action", () => {
    const addCard = vi.fn();
    const rename = vi.fn();
    const entries = buildColumnContextMenu({ addCard, rename });

    select(entries, "Add Card…");
    expect(addCard).toHaveBeenCalledTimes(1);
    expect(rename).not.toHaveBeenCalled();

    select(entries, "Rename Column");
    expect(rename).toHaveBeenCalledTimes(1);
  });
});

describe("buildCardContextMenu", () => {
  const card: Card = {
    path: "notes/card.md",
    absolutePath: "/board/notes/card.md",
    displayTitle: "Card",
    fileState: "available",
    labels: [],
  };
  const board: Board = {
    version: 1,
    name: "Board",
    labels: [],
    columns: [
      { id: "todo", name: "Todo", cards: [card] },
      { id: "doing", name: "Doing", cards: [] },
      { id: "done", name: "Done", cards: [] },
    ],
  };

  it("offers both paths and other columns in board order", () => {
    const copyText = vi.fn();
    const moveToColumn = vi.fn();
    const entries = buildCardContextMenu(card, board, {
      copyText,
      moveToColumn,
    });

    expect(entries.map((entry) => entry.kind)).toEqual([
      "item",
      "item",
      "separator",
      "submenu",
    ]);
    select(entries, "Copy Path");
    select(entries, "Copy Absolute Path");
    expect(copyText).toHaveBeenNthCalledWith(1, "notes/card.md");
    expect(copyText).toHaveBeenNthCalledWith(2, "/board/notes/card.md");
    expect(copyText).toHaveBeenCalledTimes(2);
    const move = entries[3];
    if (move.kind !== "submenu") throw new Error("no Move to submenu");
    expect(move.entries.map((entry) => entry.kind === "item" && entry.label))
      .toEqual(["Doing", "Done"]);
    const destination = move.entries[1];
    if (destination.kind !== "item") throw new Error("no destination");
    destination.onSelect();
    expect(moveToColumn).toHaveBeenCalledWith("done");
  });

  it("disables an unresolved absolute path and leaves no move destinations when alone", () => {
    const unresolved = {
      ...card,
      absolutePath: undefined,
      fileState: "unresolvable" as const,
    };
    const copyText = vi.fn();
    const entries = buildCardContextMenu(
      unresolved,
      { ...board, columns: [{ ...board.columns[0], cards: [unresolved] }] },
      { copyText, moveToColumn: vi.fn() },
    );

    expect(entries[0]).toMatchObject({ label: "Copy Path", enabled: true });
    expect(entries[1]).toMatchObject({
      label: "Copy Absolute Path",
      enabled: false,
    });
    expect(entries[3]).toEqual({
      kind: "submenu",
      label: "Move to",
      entries: [],
    });
  });
});
