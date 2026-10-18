import { describe, expect, it } from "vite-plus/test";
import type { Board } from "./board.ts";
import type { Card } from "./card.ts";
import { EMPTY_CARD_FILTER } from "./cardFilter.ts";
import {
  buildCardDirectoryTree,
  buildDirectoryTree,
} from "./cardDirectoryTree.ts";
import type {
  CardTreeDirectory,
  DirectorySnapshots,
} from "./cardDirectoryTree.ts";
import type { DirEntry } from "./fileSystemPort.ts";

function card(path: string, labels: string[] = []): Card {
  return { path, labels, fileState: "unresolvable", displayTitle: path };
}
function board(...paths: string[]): Board {
  return {
    version: 1,
    name: "Test",
    labels: [],
    columns: [
      { id: "todo", name: "Todo", cards: paths.map((path) => card(path)) },
    ],
  };
}
function tree(...paths: string[]) {
  return buildCardDirectoryTree(board(...paths), EMPTY_CARD_FILTER);
}

describe("buildCardDirectoryTree", () => {
  it("builds nested directories, normalizes segments, and preserves card identity", () => {
    const source = board(
      "root.md",
      "docs/./a.md",
      "docs/design/b.md",
      "a/../back.md",
    );
    const original = structuredClone(source);
    const result = buildCardDirectoryTree(source, EMPTY_CARD_FILTER);
    expect(result.root).toMatchObject([
      {
        kind: "directory",
        key: "docs",
        name: "docs",
        path: "docs",
        children: [
          {
            kind: "directory",
            key: "docs/design",
            path: "docs/design",
            children: [{ name: "b.md" }],
          },
          {
            kind: "card",
            name: "a.md",
            card: source.columns[0].cards[1],
            column: source.columns[0],
          },
        ],
      },
      { name: "back.md" },
      { name: "root.md" },
    ]);
    expect((result.root[0] as CardTreeDirectory).children[1]).toHaveProperty(
      "card",
      source.columns[0].cards[1],
    );
    expect(source).toEqual(original);
  });

  it("folds case and composition and retains first board spelling through filters", () => {
    const source = board("Docs/Caf\u00e9/a.md", "docs/Cafe\u0301/b.md");
    source.columns[0].cards[1].labels = ["visible"];
    const result = buildCardDirectoryTree(source, {
      ...EMPTY_CARD_FILTER,
      labels: new Set(["visible"]),
    });
    expect(result.root).toMatchObject([
      {
        key: "docs",
        name: "Docs",
        path: "Docs",
        children: [
          {
            key: "docs/caf\u00e9",
            name: "Caf\u00e9",
            path: "Docs/Caf\u00e9",
            children: [{ name: "b.md" }],
          },
        ],
      },
    ]);
  });

  it("separates unresolved paths in board order independently of file state", () => {
    const result = tree(
      "/z.md",
      "../a.md",
      "../a/../b.md",
      "a/../../c.md",
      "local.md",
      "folder/../back.md",
    );
    expect(result.outside.map((node) => node.card.path)).toEqual([
      "/z.md",
      "../a.md",
      "../a/../b.md",
      "a/../../c.md",
    ]);
    expect(result.root.map((node) => node.name)).toEqual([
      "back.md",
      "local.md",
    ]);
  });

  it("prunes empty branches for both label and column filters including outside cards", () => {
    const source = board("hidden/a.md", "visible/b.md", "../outside.md");
    source.columns[0].cards[1].labels = ["bug"];
    expect(
      buildCardDirectoryTree(source, {
        ...EMPTY_CARD_FILTER,
        labels: new Set(["bug"]),
      }).root.map((node) => node.name),
    ).toEqual(["visible"]);
    expect(
      buildCardDirectoryTree(source, {
        ...EMPTY_CARD_FILTER,
        hiddenColumnIds: new Set(["todo"]),
      }),
    ).toEqual({ root: [], outside: [] });
  });

  it("sorts directories first and names numerically with stable board-order ties", () => {
    const result = tree(
      "card-10.md",
      "z/card.md",
      "card-2.md",
      "a10/card.md",
      "a2/card.md",
      "item-02.md",
      "item-2.md",
    );
    expect(result.root.map((node) => node.name)).toEqual([
      "a2",
      "a10",
      "z",
      "card-2.md",
      "card-10.md",
      "item-02.md",
      "item-2.md",
    ]);
  });

  it("keeps directory and card nodes distinct even when a broken reference names a directory", () => {
    expect(
      tree("docs.md", "docs.md/a.md").root.map((node) => node.kind),
    ).toEqual(["directory", "card"]);
  });
});

function file(name: string): DirEntry {
  return { name, isDirectory: false };
}

function directory(name: string): DirEntry {
  return { name, isDirectory: true };
}

describe("buildDirectoryTree", () => {
  it("merges nested listings, empty directories and Markdown files without changing inputs", () => {
    const source = board(
      "docs/card.md",
      "missing/deep/card.md",
      "../outside.md",
    );
    const snapshots: DirectorySnapshots = new Map([
      [
        "",
        Object.freeze([
          directory("docs"),
          directory("empty"),
          file("root.MD"),
          file("image.png"),
        ]),
      ],
      [
        "docs",
        Object.freeze([file("card.md"), directory("design"), file("notes.md")]),
      ],
      ["docs/design", Object.freeze([file("draft.md")])],
      ["empty", Object.freeze([])],
    ]);
    const original = structuredClone({ source, snapshots });
    const result = buildDirectoryTree(source, EMPTY_CARD_FILTER, snapshots);
    expect(result.root).toMatchObject([
      {
        kind: "directory",
        key: "docs",
        hasCardDescendants: true,
        children: [
          {
            kind: "directory",
            key: "docs/design",
            hasCardDescendants: false,
            children: [{ kind: "file", path: "docs/design/draft.md" }],
          },
          { kind: "card", name: "card.md" },
          { kind: "file", path: "docs/notes.md" },
        ],
      },
      {
        kind: "directory",
        key: "empty",
        hasCardDescendants: false,
        children: [],
      },
      {
        kind: "directory",
        key: "missing",
        hasCardDescendants: true,
        children: [
          {
            key: "missing/deep",
            hasCardDescendants: true,
            children: [{ kind: "card" }],
          },
        ],
      },
      { kind: "file", name: "root.MD", path: "root.MD" },
    ]);
    expect(result.outside.map((node) => node.card.path)).toEqual([
      "../outside.md",
    ]);
    expect({ source, snapshots }).toEqual(original);
    const docs = result.root[0];
    if (docs.kind !== "directory") throw new Error("Expected docs directory");
    const cardNode = docs.children[1];
    if (cardNode.kind !== "card") throw new Error("Expected card");
    expect(cardNode.card).toBe(source.columns[0].cards[0]);
    expect(cardNode.column).toBe(source.columns[0]);
  });

  it("matches normalized card paths with folded FS names and keeps board spelling and file state", () => {
    const source = board("Docs/./Caf\u00e9/A.md");
    source.columns[0].cards[0].fileState = "missing";
    const result = buildDirectoryTree(
      source,
      EMPTY_CARD_FILTER,
      new Map([
        ["", [directory("docs")]],
        ["docs", [directory("Cafe\u0301")]],
        ["docs/café", [file("a.MD"), file("new.md")]],
      ]),
    );
    expect(result.root).toMatchObject([
      {
        name: "Docs",
        path: "Docs",
        children: [
          {
            key: "docs/café",
            name: "Café",
            path: "Docs/Café",
            children: [
              { kind: "card", name: "A.md", card: { fileState: "missing" } },
              { kind: "file", path: "Docs/Café/new.md" },
            ],
          },
        ],
      },
    ]);
  });

  it("replaces listings and ignores stale descendants no longer reachable from the root", () => {
    const source = board("docs/card.md");
    const snapshots = new Map([
      ["", [directory("docs"), directory("removed")]],
      ["docs", [file("old.md")]],
      ["removed", [file("stale.md")]],
    ]);
    const first = buildDirectoryTree(source, EMPTY_CARD_FILTER, snapshots);
    expect(first.root).toHaveLength(2);
    expect(first.root[0]).toMatchObject({
      children: [{ name: "card.md" }, { name: "old.md" }],
    });
    snapshots.set("", []);
    snapshots.set("docs", []);
    const next = buildDirectoryTree(source, EMPTY_CARD_FILTER, snapshots);
    expect(next.root).toMatchObject([
      {
        key: "docs",
        children: [{ kind: "card", name: "card.md" }],
      },
    ]);
    expect(next.root).toHaveLength(1);
  });

  it("keeps every card that names the same file in board order", () => {
    const source = board("a.md", "./A.md");
    const result = buildDirectoryTree(
      source,
      EMPTY_CARD_FILTER,
      new Map([["", [file("a.md")]]]),
    );
    expect(result.root).toHaveLength(2);
    expect(
      result.root.map((node) => node.kind === "card" && node.card),
    ).toEqual(source.columns[0].cards);
  });

  it("uses the current board to replace file rows with cards and back again", () => {
    const snapshots = new Map([["", [file("task.md")]]]);
    expect(
      buildDirectoryTree(board(), EMPTY_CARD_FILTER, snapshots).root,
    ).toMatchObject([{ kind: "file" }]);
    expect(
      buildDirectoryTree(board("task.md"), EMPTY_CARD_FILTER, snapshots).root,
    ).toMatchObject([{ kind: "card" }]);
    expect(
      buildDirectoryTree(board(), EMPTY_CARD_FILTER, snapshots).root,
    ).toMatchObject([{ kind: "file" }]);
  });

  it("preserves hidden card paths while excluding hidden FS entries and non-Markdown files", () => {
    const result = buildDirectoryTree(
      board(".private/.card.md"),
      EMPTY_CARD_FILTER,
      new Map([
        [
          "",
          [
            directory(".private"),
            directory(".ignored"),
            file(".hidden.md"),
            file("readme.Md"),
            file("notes.md.txt"),
          ],
        ],
        [
          ".private",
          [file(".card.md"), file("visible.md"), file(".hidden.md")],
        ],
        [".ignored", [file("unreachable.md")]],
      ]),
    );
    expect(result.root).toMatchObject([
      {
        key: ".private",
        hasCardDescendants: true,
        children: [
          { kind: "card", name: ".card.md" },
          { kind: "file", path: ".private/visible.md" },
        ],
      },
      { kind: "file", name: "readme.Md" },
    ]);
  });

  it.each(["label", "column"])(
    "hides FS-only branches and never revives filtered cards (%s)",
    (axis) => {
      const source = board(
        "hidden/a.md",
        "shared/hidden.md",
        "shared/visible.md",
        "../outside.md",
      );
      source.columns[0].cards[2].labels = ["visible"];
      if (axis === "column") {
        const visible = source.columns[0].cards.splice(2, 1);
        source.columns.push({ id: "visible", name: "Visible", cards: visible });
      }
      const criteria =
        axis === "label"
          ? { ...EMPTY_CARD_FILTER, labels: new Set(["visible"]) }
          : { ...EMPTY_CARD_FILTER, hiddenColumnIds: new Set(["todo"]) };
      const result = buildDirectoryTree(
        source,
        criteria,
        new Map([
          [
            "",
            [
              directory("hidden"),
              directory("shared"),
              directory("empty"),
              file("root.md"),
            ],
          ],
          ["hidden", [file("a.md")]],
          ["shared", [file("hidden.md"), file("visible.md"), file("other.md")]],
        ]),
      );
      expect(result).toMatchObject({
        root: [
          {
            key: "shared",
            hasCardDescendants: true,
            children: [{ kind: "card", name: "visible.md" }],
          },
        ],
        outside: [],
      });
      expect(result.root).toHaveLength(1);
      const shared = result.root[0];
      if (shared.kind !== "directory")
        throw new Error("Expected shared directory");
      expect(shared.children).toHaveLength(1);
    },
  );

  it("does not treat deleted column ids as active filters", () => {
    const result = buildDirectoryTree(
      board(),
      {
        ...EMPTY_CARD_FILTER,
        hiddenColumnIds: new Set(["deleted"]),
      },
      new Map([["", [directory("empty"), file("notes.md")]]]),
    );
    expect(result.root.map((node) => node.kind)).toEqual(["directory", "file"]);
  });

  it("preserves the first board directory spelling even when its first card is filtered", () => {
    const source = board("Docs/hidden.md", "docs/visible.md");
    source.columns[0].cards[1].labels = ["visible"];
    const result = buildDirectoryTree(
      source,
      {
        ...EMPTY_CARD_FILTER,
        labels: new Set(["visible"]),
      },
      new Map([["", [directory("DOCS")]]]),
    );
    expect(result.root).toMatchObject([
      {
        name: "Docs",
        path: "Docs",
        hasCardDescendants: true,
        children: [{ name: "visible.md" }],
      },
    ]);
  });

  it("sorts directories first, interleaves files and cards numerically, and stabilizes ties", () => {
    const source = board("item-2.md", "item-02.md", "card-10.md");
    const entries = [
      file("item-002.md"),
      file("note-2.md"),
      directory("z"),
      file("card-2.md"),
      file("note-02.md"),
      directory("a10"),
      directory("a2"),
    ];
    const result = buildDirectoryTree(
      source,
      EMPTY_CARD_FILTER,
      new Map([["", entries]]),
    );
    expect(result.root.map((node) => node.name)).toEqual([
      "a2",
      "a10",
      "z",
      "card-2.md",
      "card-10.md",
      "item-2.md",
      "item-02.md",
      "item-002.md",
      "note-02.md",
      "note-2.md",
    ]);
    expect(
      buildDirectoryTree(
        source,
        EMPTY_CARD_FILTER,
        new Map([["", [...entries].reverse()]]),
      ),
    ).toEqual(result);
  });

  it("keeps colliding directory and card nodes distinct", () => {
    const result = buildDirectoryTree(
      board("docs.md"),
      EMPTY_CARD_FILTER,
      new Map([
        ["", [directory("docs.md")]],
        ["docs.md", [file("nested.md")]],
      ]),
    );
    expect(result.root).toMatchObject([
      {
        kind: "directory",
        hasCardDescendants: false,
        children: [{ kind: "file" }],
      },
      { kind: "card", name: "docs.md" },
    ]);
  });

  it("keeps outside cards in board order without using outside snapshots", () => {
    const result = buildDirectoryTree(
      board("../z.md", "/a.md", "x/../../b.md", "a/../root.md"),
      EMPTY_CARD_FILTER,
      new Map([
        ["..", [file("extra.md")]],
        ["/", [file("absolute.md")]],
      ]),
    );
    expect(result.root).toMatchObject([{ kind: "card", name: "root.md" }]);
    expect(result.outside.map((node) => node.card.path)).toEqual([
      "../z.md",
      "/a.md",
      "x/../../b.md",
    ]);
  });
});
