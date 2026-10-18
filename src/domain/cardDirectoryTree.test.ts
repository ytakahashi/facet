import { describe, expect, it } from "vite-plus/test";
import type { Board } from "./board.ts";
import type { Card } from "./card.ts";
import { EMPTY_CARD_FILTER } from "./cardFilter.ts";
import { buildCardDirectoryTree } from "./cardDirectoryTree.ts";
import type { CardTreeDirectory } from "./cardDirectoryTree.ts";

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
