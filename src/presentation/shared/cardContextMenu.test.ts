import { describe, expect, it, vi } from "vite-plus/test";
import type { ContextMenuEntry } from "../context/appContext.ts";
import type { Board } from "../../domain/board.ts";
import type { Card } from "../../domain/card.ts";
import { buildCardContextMenu } from "./cardContextMenu.ts";

function select(entries: ContextMenuEntry[], label: string): void {
  const entry = entries.find(
    (candidate) => candidate.kind === "item" && candidate.label === label,
  );
  if (entry?.kind !== "item") throw new Error(`no item labelled ${label}`);
  entry.onSelect();
}

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
    const reveal = vi.fn();
    const moveToColumn = vi.fn();
    const duplicateCard = vi.fn();
    const entries = buildCardContextMenu(card, board, {
      duplicateCard,
      canDuplicateCard: true,
      copyText,
      reveal,
      moveToColumn,
    });

    expect(entries.map((entry) => entry.kind)).toEqual([
      "item",
      "item",
      "separator",
      "item",
      "separator",
      "item",
      "submenu",
    ]);
    select(entries, "Duplicate Card");
    expect(duplicateCard).toHaveBeenCalledOnce();
    select(entries, "Copy Path");
    select(entries, "Copy Absolute Path");
    expect(copyText).toHaveBeenNthCalledWith(1, "notes/card.md");
    expect(copyText).toHaveBeenNthCalledWith(2, "/board/notes/card.md");
    expect(copyText).toHaveBeenCalledTimes(2);
    select(entries, "Reveal in Finder");
    expect(reveal).toHaveBeenCalledWith("/board/notes/card.md");
    const move = entries[6];
    if (move.kind !== "submenu") throw new Error("no Move to submenu");
    expect(
      move.entries.map((entry) => entry.kind === "item" && entry.label),
    ).toEqual(["Doing", "Done"]);
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
      {
        duplicateCard: vi.fn(),
        canDuplicateCard: true,
        copyText,
        reveal: vi.fn(),
        moveToColumn: vi.fn(),
      },
    );

    expect(entries[0]).toMatchObject({ label: "Copy Path", enabled: true });
    expect(entries[1]).toMatchObject({
      label: "Copy Absolute Path",
      enabled: false,
    });
    expect(entries[3]).toMatchObject({
      label: "Reveal in Finder",
      enabled: false,
    });
    expect(entries[6]).toEqual({
      kind: "submenu",
      label: "Move to",
      entries: [],
    });
  });

  it("keeps Reveal in Finder enabled for a missing card with a resolved path", () => {
    const missing = { ...card, fileState: "missing" as const };
    const reveal = vi.fn();
    const entries = buildCardContextMenu(
      missing,
      { ...board, columns: [{ ...board.columns[0], cards: [missing] }] },
      {
        duplicateCard: vi.fn(),
        canDuplicateCard: true,
        copyText: vi.fn(),
        reveal,
        moveToColumn: vi.fn(),
      },
    );

    expect(entries[3]).toMatchObject({ enabled: true });
    select(entries, "Reveal in Finder");
    expect(reveal).toHaveBeenCalledWith("/board/notes/card.md");
  });
  it("uses the supplied duplication availability", () => {
    const entries = buildCardContextMenu(card, board, {
      duplicateCard: vi.fn(),
      canDuplicateCard: false,
      copyText: vi.fn(),
      reveal: vi.fn(),
      moveToColumn: vi.fn(),
    });
    expect(
      entries.find(
        (entry) => entry.kind === "item" && entry.label === "Duplicate Card",
      ),
    ).toMatchObject({ enabled: false });
  });
});
