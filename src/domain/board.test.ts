import { describe, expect, it } from "vitest";
import type { Board, Column } from "./board.ts";
import {
  addCard,
  addColumn,
  addLabelDefinition,
  addLabelToCard,
  CardAlreadyExistsError,
  containsCardPath,
  createEmptyBoard,
  findCardByPath,
  findLabelDefinition,
  LabelAlreadyExistsError,
  moveCard,
  removeColumn,
  removeLabelDefinition,
  removeLabelFromCard,
  renameBoard,
  renameColumn,
  renameLabelDefinition,
  setCardPriority,
  setCardTitle,
  setLabelColor,
} from "./board.ts";
import type { Card } from "./card.ts";
import type { LabelDefinition } from "./label.ts";

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    path: "card.md",
    labels: [],
    displayTitle: "Card",
    ...overrides,
  };
}

function makeColumn(overrides: Partial<Column> = {}): Column {
  return {
    id: "column",
    name: "Column",
    cards: [],
    ...overrides,
  };
}

function makeLabel(overrides: Partial<LabelDefinition> = {}): LabelDefinition {
  return {
    name: "ui",
    color: "ruby",
    ...overrides,
  };
}

function makeBoard(overrides: Partial<Board> = {}): Board {
  return {
    version: 1,
    name: "Board",
    labels: [],
    columns: [],
    ...overrides,
  };
}

describe("moveCard", () => {
  it("moves a card later in the same column, inserting before the card originally at the target index", () => {
    const a = makeCard({ path: "a.md" });
    const b = makeCard({ path: "b.md" });
    const c = makeCard({ path: "c.md" });
    const board = makeBoard({
      columns: [makeColumn({ id: "doing", cards: [a, b, c] })],
    });

    const result = moveCard(
      board,
      { columnId: "doing", index: 0 },
      { columnId: "doing", index: 2 },
    );

    expect(result.columns[0].cards).toEqual([b, a, c]);
  });

  it("moves a card forward within the same column", () => {
    const a = makeCard({ path: "a.md" });
    const b = makeCard({ path: "b.md" });
    const c = makeCard({ path: "c.md" });
    const board = makeBoard({
      columns: [makeColumn({ id: "doing", cards: [a, b, c] })],
    });

    const result = moveCard(
      board,
      { columnId: "doing", index: 2 },
      { columnId: "doing", index: 0 },
    );

    expect(result.columns[0].cards).toEqual([c, a, b]);
  });

  it("leaves the order unchanged when dropped back at its own position", () => {
    const a = makeCard({ path: "a.md" });
    const b = makeCard({ path: "b.md" });
    const board = makeBoard({
      columns: [makeColumn({ id: "doing", cards: [a, b] })],
    });

    const result = moveCard(
      board,
      { columnId: "doing", index: 0 },
      { columnId: "doing", index: 0 },
    );

    expect(result.columns[0].cards).toEqual([a, b]);
  });

  it("moves a card into the middle of a different column", () => {
    const moved = makeCard({ path: "moved.md" });
    const x = makeCard({ path: "x.md" });
    const y = makeCard({ path: "y.md" });
    const board = makeBoard({
      columns: [
        makeColumn({ id: "doing", cards: [moved] }),
        makeColumn({ id: "done", cards: [x, y] }),
      ],
    });

    const result = moveCard(
      board,
      { columnId: "doing", index: 0 },
      { columnId: "done", index: 1 },
    );

    expect(result.columns[0].cards).toEqual([]);
    expect(result.columns[1].cards).toEqual([x, moved, y]);
  });

  it("appends a card to the end of a different column using Infinity", () => {
    const moved = makeCard({ path: "moved.md" });
    const x = makeCard({ path: "x.md" });
    const board = makeBoard({
      columns: [
        makeColumn({ id: "doing", cards: [moved] }),
        makeColumn({ id: "done", cards: [x] }),
      ],
    });

    const result = moveCard(
      board,
      { columnId: "doing", index: 0 },
      { columnId: "done", index: Number.POSITIVE_INFINITY },
    );

    expect(result.columns[1].cards).toEqual([x, moved]);
  });

  it("moves a card into an empty column", () => {
    const moved = makeCard({ path: "moved.md" });
    const board = makeBoard({
      columns: [
        makeColumn({ id: "doing", cards: [moved] }),
        makeColumn({ id: "done", cards: [] }),
      ],
    });

    const result = moveCard(
      board,
      { columnId: "doing", index: 0 },
      { columnId: "done", index: Number.POSITIVE_INFINITY },
    );

    expect(result.columns[1].cards).toEqual([moved]);
  });
});

describe("addCard", () => {
  it("appends a card to the target column without changing other columns", () => {
    const existing = makeCard({ path: "existing.md" });
    const added = makeCard({ path: "added.md" });
    const untouched = makeColumn({ id: "done", cards: [existing] });
    const board = makeBoard({
      columns: [makeColumn({ id: "doing" }), untouched],
    });

    const result = addCard(board, "doing", added);

    expect(result.columns[0].cards).toEqual([added]);
    expect(result.columns[1]).toBe(untouched);
    expect(board.columns[0].cards).toEqual([]);
  });

  it("rejects an unknown target column", () => {
    const board = makeBoard({ columns: [makeColumn({ id: "doing" })] });

    const act = () => addCard(board, "missing", makeCard());

    expect(act).toThrow("Unknown column: missing");
  });

  it("rejects a path already present on the board after normalization", () => {
    const board = makeBoard({
      columns: [makeColumn({ cards: [makeCard({ path: "notes/card.md" })] })],
    });

    const act = () =>
      addCard(
        board,
        "column",
        makeCard({ path: "./notes/other/../card.md" }),
      );

    expect(act).toThrow(CardAlreadyExistsError);
  });
});

describe("findCardByPath", () => {
  it("finds a card by path across columns", () => {
    const target = makeCard({ path: "target.md" });
    const board = makeBoard({
      columns: [
        makeColumn({ id: "doing", cards: [makeCard({ path: "other.md" })] }),
        makeColumn({ id: "done", cards: [target] }),
      ],
    });

    const result = findCardByPath(board, "target.md");

    expect(result).toBe(target);
  });

  it("returns undefined when no card matches the path", () => {
    const board = makeBoard({
      columns: [makeColumn({ cards: [makeCard({ path: "a.md" })] })],
    });

    const result = findCardByPath(board, "missing.md");

    expect(result).toBeUndefined();
  });
});

describe("setCardTitle", () => {
  it("sets titleOverride and displayTitle to the given title, keeping other cards untouched", () => {
    const target = makeCard({ path: "target.md", displayTitle: "Original" });
    const untouched = makeCard({ path: "other.md" });
    const board = makeBoard({
      columns: [makeColumn({ id: "doing", cards: [target, untouched] })],
    });

    const result = setCardTitle(board, "target.md", "New Title");

    expect(result.columns[0].cards[0]).toEqual({
      ...target,
      titleOverride: "New Title",
      displayTitle: "New Title",
    });
    expect(result.columns[0].cards[1]).toBe(untouched);
    expect(board.columns[0].cards[0]).toBe(target);
  });

  it("rejects a blank title", () => {
    const board = makeBoard({
      columns: [makeColumn({ cards: [makeCard({ path: "target.md" })] })],
    });

    const act = () => setCardTitle(board, "target.md", "  ");

    expect(act).toThrow("Card title must not be empty");
  });

  it("rejects an unknown card path", () => {
    const board = makeBoard({
      columns: [makeColumn({ cards: [makeCard({ path: "target.md" })] })],
    });

    const act = () => setCardTitle(board, "missing.md", "New Title");

    expect(act).toThrow("Unknown card: missing.md");
  });
});

describe("setCardPriority", () => {
  it("sets the priority, keeping other cards untouched", () => {
    const target = makeCard({ path: "target.md" });
    const untouched = makeCard({ path: "other.md" });
    const board = makeBoard({
      columns: [makeColumn({ id: "doing", cards: [target, untouched] })],
    });

    const result = setCardPriority(board, "target.md", "high");

    expect(result.columns[0].cards[0]).toEqual({ ...target, priority: "high" });
    expect(result.columns[0].cards[1]).toBe(untouched);
    expect(board.columns[0].cards[0]).toBe(target);
  });

  it("clears the priority when given undefined", () => {
    const target = makeCard({ path: "target.md", priority: "medium" });
    const board = makeBoard({
      columns: [makeColumn({ cards: [target] })],
    });

    const result = setCardPriority(board, "target.md", undefined);

    expect(result.columns[0].cards[0].priority).toBeUndefined();
  });

  it("rejects an unknown card path", () => {
    const board = makeBoard({
      columns: [makeColumn({ cards: [makeCard({ path: "target.md" })] })],
    });

    const act = () => setCardPriority(board, "missing.md", "low");

    expect(act).toThrow("Unknown card: missing.md");
  });
});

describe("findLabelDefinition", () => {
  it("finds a label definition by name", () => {
    const label = makeLabel({ name: "ui" });
    const board = makeBoard({ labels: [label, makeLabel({ name: "docs" })] });

    const result = findLabelDefinition(board, "ui");

    expect(result).toBe(label);
  });

  it("returns undefined when no label matches the name", () => {
    const board = makeBoard({ labels: [makeLabel({ name: "ui" })] });

    const result = findLabelDefinition(board, "missing");

    expect(result).toBeUndefined();
  });
});

describe("addLabelDefinition", () => {
  it("appends the label to the registry without changing existing entries", () => {
    const existing = makeLabel({ name: "ui", color: "ruby" });
    const board = makeBoard({ labels: [existing] });
    const added = makeLabel({ name: "docs", color: "sapphire" });

    const result = addLabelDefinition(board, added);

    expect(result.labels).toEqual([existing, added]);
    expect(result.labels[0]).toBe(existing);
    expect(board.labels).toEqual([existing]);
  });

  it("rejects a blank name", () => {
    const board = makeBoard();

    const act = () => addLabelDefinition(board, makeLabel({ name: "  " }));

    expect(act).toThrow("Label name must not be empty");
  });

  it("rejects a duplicate name", () => {
    const board = makeBoard({ labels: [makeLabel({ name: "ui" })] });

    const act = () =>
      addLabelDefinition(board, makeLabel({ name: "ui", color: "jade" }));

    expect(act).toThrow(LabelAlreadyExistsError);
  });
});

describe("renameLabelDefinition", () => {
  it("renames the registry entry and every card referencing it, keeping other cards untouched", () => {
    const untouchedLabel = makeLabel({ name: "docs" });
    const renamedLabel = makeLabel({ name: "ui" });
    const taggedCard = makeCard({ path: "a.md", labels: ["ui", "docs"] });
    const untouchedCard = makeCard({ path: "b.md", labels: ["docs"] });
    const board = makeBoard({
      labels: [renamedLabel, untouchedLabel],
      columns: [
        makeColumn({ cards: [taggedCard, untouchedCard] }),
      ],
    });

    const result = renameLabelDefinition(board, "ui", "interface");

    expect(result.labels).toEqual([
      { ...renamedLabel, name: "interface" },
      untouchedLabel,
    ]);
    expect(result.columns[0].cards[0].labels).toEqual(["interface", "docs"]);
    expect(result.columns[0].cards[1]).toBe(untouchedCard);
    expect(board.labels[0].name).toBe("ui");
  });

  it("dedupes a card that already lists both the old and new name", () => {
    const board = makeBoard({
      labels: [makeLabel({ name: "ui" })],
      columns: [
        makeColumn({
          cards: [makeCard({ labels: ["ui", "interface"] })],
        }),
      ],
    });

    const result = renameLabelDefinition(board, "ui", "interface");

    expect(result.columns[0].cards[0].labels).toEqual(["interface"]);
  });

  it("rejects renaming to a name that already exists", () => {
    const board = makeBoard({
      labels: [makeLabel({ name: "ui" }), makeLabel({ name: "docs" })],
    });

    const act = () => renameLabelDefinition(board, "ui", "docs");

    expect(act).toThrow(LabelAlreadyExistsError);
  });

  it("rejects an unknown label name", () => {
    const board = makeBoard({ labels: [makeLabel({ name: "ui" })] });

    const act = () => renameLabelDefinition(board, "missing", "interface");

    expect(act).toThrow("Unknown label: missing");
  });
});

describe("setLabelColor", () => {
  it("changes only the color, keeping other entries untouched", () => {
    const untouched = makeLabel({ name: "docs", color: "jade" });
    const board = makeBoard({
      labels: [makeLabel({ name: "ui", color: "ruby" }), untouched],
    });

    const result = setLabelColor(board, "ui", "sapphire");

    expect(result.labels[0]).toEqual({ name: "ui", color: "sapphire" });
    expect(result.labels[1]).toBe(untouched);
  });

  it("rejects an unknown label name", () => {
    const board = makeBoard();

    const act = () => setLabelColor(board, "missing", "ruby");

    expect(act).toThrow("Unknown label: missing");
  });
});

describe("removeLabelDefinition", () => {
  it("removes the registry entry and strips it from every card that had it", () => {
    const untouchedLabel = makeLabel({ name: "docs" });
    const taggedCard = makeCard({ path: "a.md", labels: ["ui", "docs"] });
    const untaggedCard = makeCard({ path: "b.md", labels: ["docs"] });
    const board = makeBoard({
      labels: [makeLabel({ name: "ui" }), untouchedLabel],
      columns: [makeColumn({ cards: [taggedCard, untaggedCard] })],
    });

    const result = removeLabelDefinition(board, "ui");

    expect(result.labels).toEqual([untouchedLabel]);
    expect(result.columns[0].cards[0].labels).toEqual(["docs"]);
    expect(result.columns[0].cards[1]).toBe(untaggedCard);
    expect(board.labels).toHaveLength(2);
  });

  it("rejects an unknown label name", () => {
    const board = makeBoard();

    const act = () => removeLabelDefinition(board, "missing");

    expect(act).toThrow("Unknown label: missing");
  });
});

describe("addLabelToCard", () => {
  it("appends the label to the card, keeping other cards untouched", () => {
    const target = makeCard({ path: "target.md", labels: [] });
    const untouched = makeCard({ path: "other.md", labels: [] });
    const board = makeBoard({
      labels: [makeLabel({ name: "ui" })],
      columns: [makeColumn({ cards: [target, untouched] })],
    });

    const result = addLabelToCard(board, "target.md", "ui");

    expect(result.columns[0].cards[0].labels).toEqual(["ui"]);
    expect(result.columns[0].cards[1]).toBe(untouched);
    expect(board.columns[0].cards[0]).toBe(target);
  });

  it("rejects a label name that is not in the registry", () => {
    const board = makeBoard({
      columns: [makeColumn({ cards: [makeCard({ path: "target.md" })] })],
    });

    const act = () => addLabelToCard(board, "target.md", "missing");

    expect(act).toThrow("Unknown label: missing");
  });

  it("rejects a label already on the card", () => {
    const board = makeBoard({
      labels: [makeLabel({ name: "ui" })],
      columns: [
        makeColumn({
          cards: [makeCard({ path: "target.md", labels: ["ui"] })],
        }),
      ],
    });

    const act = () => addLabelToCard(board, "target.md", "ui");

    expect(act).toThrow("Label already on card: ui");
  });

  it("rejects an unknown card path", () => {
    const board = makeBoard({ labels: [makeLabel({ name: "ui" })] });

    const act = () => addLabelToCard(board, "missing.md", "ui");

    expect(act).toThrow("Unknown card: missing.md");
  });
});

describe("removeLabelFromCard", () => {
  it("removes the label from the card, keeping other cards untouched", () => {
    const untouched = makeCard({ path: "other.md", labels: ["ui"] });
    const board = makeBoard({
      labels: [makeLabel({ name: "ui" })],
      columns: [
        makeColumn({
          cards: [
            makeCard({ path: "target.md", labels: ["ui", "docs"] }),
            untouched,
          ],
        }),
      ],
    });

    const result = removeLabelFromCard(board, "target.md", "ui");

    expect(result.columns[0].cards[0].labels).toEqual(["docs"]);
    expect(result.columns[0].cards[1]).toBe(untouched);
  });

  it("rejects a label not on the card", () => {
    const board = makeBoard({
      columns: [
        makeColumn({ cards: [makeCard({ path: "target.md", labels: [] })] }),
      ],
    });

    const act = () => removeLabelFromCard(board, "target.md", "ui");

    expect(act).toThrow("Label not on card: ui");
  });

  it("rejects an unknown card path", () => {
    const board = makeBoard();

    const act = () => removeLabelFromCard(board, "missing.md", "ui");

    expect(act).toThrow("Unknown card: missing.md");
  });
});

describe("addColumn", () => {
  it("appends the column to the right end without changing existing columns", () => {
    const existing = makeColumn({ id: "doing", cards: [makeCard()] });
    const board = makeBoard({ columns: [existing] });
    const added = makeColumn({ id: "added", name: "Added" });

    const result = addColumn(board, added);

    expect(result.columns).toEqual([existing, added]);
    expect(result.columns[0]).toBe(existing);
    expect(board.columns).toEqual([existing]);
  });

  it("rejects a duplicate column id", () => {
    const board = makeBoard({ columns: [makeColumn({ id: "doing" })] });

    const act = () =>
      addColumn(board, makeColumn({ id: "doing", name: "Doing again" }));

    expect(act).toThrow("Duplicate column id: doing");
  });

  it("rejects a blank column name", () => {
    const board = makeBoard();

    const act = () => addColumn(board, makeColumn({ id: "blank", name: "  " }));

    expect(act).toThrow("Column name must not be empty");
  });
});

describe("renameColumn", () => {
  it("changes only the name, keeping the id and the cards reference", () => {
    const cards = [makeCard()];
    const untouched = makeColumn({ id: "done" });
    const board = makeBoard({
      columns: [makeColumn({ id: "doing", name: "Doing", cards }), untouched],
    });

    const result = renameColumn(board, "doing", "In Progress");

    expect(result.columns[0].id).toBe("doing");
    expect(result.columns[0].name).toBe("In Progress");
    expect(result.columns[0].cards).toBe(cards);
    expect(result.columns[1]).toBe(untouched);
    expect(board.columns[0].name).toBe("Doing");
  });

  it("rejects a blank name", () => {
    const board = makeBoard({ columns: [makeColumn({ id: "doing" })] });

    const act = () => renameColumn(board, "doing", "  ");

    expect(act).toThrow("Column name must not be empty");
  });

  it("rejects an unknown column", () => {
    const board = makeBoard({ columns: [makeColumn({ id: "doing" })] });

    const act = () => renameColumn(board, "missing", "New name");

    expect(act).toThrow("Unknown column: missing");
  });
});

describe("removeColumn", () => {
  it("removes an empty column without changing other columns", () => {
    const untouched = makeColumn({ id: "doing", cards: [makeCard()] });
    const board = makeBoard({
      columns: [untouched, makeColumn({ id: "done" })],
    });

    const result = removeColumn(board, "done");

    expect(result.columns).toEqual([untouched]);
    expect(result.columns[0]).toBe(untouched);
    expect(board.columns).toHaveLength(2);
  });

  it("rejects a column that still holds cards", () => {
    const board = makeBoard({
      columns: [makeColumn({ id: "doing", cards: [makeCard()] })],
    });

    const act = () => removeColumn(board, "doing");

    expect(act).toThrow("Column is not empty: doing");
  });

  it("rejects an unknown column", () => {
    const board = makeBoard({ columns: [makeColumn({ id: "doing" })] });

    const act = () => removeColumn(board, "missing");

    expect(act).toThrow("Unknown column: missing");
  });
});

describe("containsCardPath", () => {
  it("finds an equivalent path in any column", () => {
    const board = makeBoard({
      columns: [makeColumn({ cards: [makeCard({ path: "./notes/card.md" })] })],
    });

    const result = containsCardPath(board, "notes/card.md");

    expect(result).toBe(true);
  });
});

describe("renameBoard", () => {
  it("renames the board and keeps the columns reference", () => {
    const columns = [makeColumn({ cards: [makeCard()] })];
    const board = makeBoard({ name: "Before", columns });

    const result = renameBoard(board, "After");

    expect(result.name).toBe("After");
    expect(result.columns).toBe(columns);
    expect(board.name).toBe("Before");
  });

  it("rejects a blank name", () => {
    const board = makeBoard();

    const act = () => renameBoard(board, "   ");

    expect(act).toThrow("Board name must not be empty");
  });
});

describe("createEmptyBoard", () => {
  it("creates a board with the current schema version and no columns", () => {
    const result = createEmptyBoard("My Board");

    expect(result).toEqual({
      version: 1,
      name: "My Board",
      labels: [],
      columns: [],
    });
  });

  it("rejects a blank name", () => {
    const act = () => createEmptyBoard("   ");

    expect(act).toThrow("Board name must not be empty");
  });
});
