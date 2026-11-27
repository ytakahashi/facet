import { describe, expect, it, vi } from "vite-plus/test";
import type { ContextMenuEntry } from "../context/appContext.ts";
import type { Board } from "../../domain/board.ts";
import type { Card } from "../../domain/card.ts";
import { buildCardContextMenu } from "./cardContextMenu.ts";

function select(entries: readonly ContextMenuEntry[], label: string): void {
  const entry = entries.find(
    (candidate) => candidate.kind === "item" && candidate.label === label,
  );
  if (entry?.kind !== "item") throw new Error(`no item labelled ${label}`);
  entry.onSelect();
}

function moveEntries(entries: readonly ContextMenuEntry[]) {
  const move = entries.find(
    (entry) => entry.kind === "submenu" && entry.label === "Move to",
  );
  if (move?.kind !== "submenu") throw new Error("no Move to submenu");
  return move.entries;
}

function makeActions() {
  return {
    duplicateCard: vi.fn(),
    canDuplicateCard: true,
    copyText: vi.fn(),
    reveal: vi.fn(),
    moveToColumn: vi.fn(),
    moveToColumnEdge: vi.fn(),
  };
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

  it("offers path, Finder, and duplication actions in menu order", () => {
    const actions = makeActions();
    const { duplicateCard, copyText, reveal } = actions;
    const entries = buildCardContextMenu(card, board, actions);

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
  });

  it("separates column edges from other columns in board order", () => {
    const actions = makeActions();
    const moves = moveEntries(buildCardContextMenu(card, board, actions));
    expect(
      moves.map((entry) => (entry.kind === "item" ? entry.label : entry.kind)),
    ).toEqual([
      "Top of this column",
      "Bottom of this column",
      "separator",
      "Doing",
      "Done",
    ]);
    select(moves, "Done");
    expect(actions.moveToColumn).toHaveBeenCalledExactlyOnceWith("done");
  });

  const before = { ...card, path: "before.md" };
  const after = { ...card, path: "after.md" };
  it.each([
    { position: "first", cards: [card, after], top: false, bottom: true },
    {
      position: "middle",
      cards: [before, card, after],
      top: true,
      bottom: true,
    },
    { position: "last", cards: [before, card], top: true, bottom: false },
    { position: "only", cards: [card], top: false, bottom: false },
  ])(
    "offers the applicable edge moves for the $position card",
    ({ cards, top, bottom }) => {
      const actions = makeActions();
      const moves = moveEntries(
        buildCardContextMenu(
          card,
          { ...board, columns: [{ ...board.columns[0], cards }] },
          actions,
        ),
      );
      expect(moves).toMatchObject([
        { kind: "item", label: "Top of this column", enabled: top },
        { kind: "item", label: "Bottom of this column", enabled: bottom },
      ]);
      if (top) select(moves, "Top of this column");
      if (bottom) select(moves, "Bottom of this column");
      expect(actions.moveToColumnEdge.mock.calls).toEqual([
        ...(top ? [["todo", "top"]] : []),
        ...(bottom ? [["todo", "bottom"]] : []),
      ]);
    },
  );

  it("disables absolute path actions for an unresolved path", () => {
    const unresolved = {
      ...card,
      absolutePath: undefined,
      fileState: "unresolvable" as const,
    };
    const entries = buildCardContextMenu(
      unresolved,
      { ...board, columns: [{ ...board.columns[0], cards: [unresolved] }] },
      makeActions(),
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
  });

  it("keeps Reveal in Finder enabled for a missing card with a resolved path", () => {
    const missing = { ...card, fileState: "missing" as const };
    const actions = makeActions();
    const entries = buildCardContextMenu(
      missing,
      { ...board, columns: [{ ...board.columns[0], cards: [missing] }] },
      actions,
    );

    expect(entries[3]).toMatchObject({ enabled: true });
    select(entries, "Reveal in Finder");
    expect(actions.reveal).toHaveBeenCalledWith("/board/notes/card.md");
  });

  it("uses the supplied duplication availability", () => {
    const entries = buildCardContextMenu(card, board, {
      ...makeActions(),
      canDuplicateCard: false,
    });
    expect(
      entries.find(
        (entry) => entry.kind === "item" && entry.label === "Duplicate Card",
      ),
    ).toMatchObject({ enabled: false });
  });
});
