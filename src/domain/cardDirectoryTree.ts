import type { Board, Column } from "./board.ts";
import type { Card } from "./card.ts";
import type { CardFilterCriteria } from "./cardFilter.ts";
import { isCardHidden } from "./cardFilter.ts";
import {
  fileNameOf,
  pathSegmentKey,
  resolveRelativeCardPath,
} from "./boardPath.ts";

export interface CardTreeCard {
  kind: "card";
  name: string;
  card: Card;
  column: Column;
}

export interface CardTreeDirectory {
  kind: "directory";
  // Folded board-relative identity, shared with directory expansion state.
  key: string;
  name: string;
  // Original spelling for clipboard and Finder operations.
  path: string;
  children: CardTreeNode[];
}

export type CardTreeNode = CardTreeDirectory | CardTreeCard;

export interface CardDirectoryTree {
  root: CardTreeNode[];
  outside: CardTreeCard[];
}

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "accent",
});

export function buildCardDirectoryTree(
  board: Board,
  criteria: CardFilterCriteria,
): CardDirectoryTree {
  const root: CardTreeNode[] = [];
  const outside: CardTreeCard[] = [];
  const directories = new Map<string, CardTreeDirectory>();
  for (const column of board.columns) {
    for (const card of column.cards) {
      const resolved = resolveRelativeCardPath(card.path);
      const node: CardTreeCard = {
        kind: "card",
        name: resolved.ok
          ? (resolved.segments.at(-1) ?? fileNameOf(card.path))
          : fileNameOf(card.path),
        card,
        column,
      };
      if (!resolved.ok) {
        if (!isCardHidden(card, column.id, criteria)) outside.push(node);
        continue;
      }
      let children = root;
      const keys: string[] = [];
      const path: string[] = [];
      // Build before filtering so the first board spelling stays stable.
      for (const name of resolved.segments.slice(0, -1)) {
        keys.push(pathSegmentKey(name));
        path.push(name);
        const key = keys.join("/");
        let directory = directories.get(key);
        if (!directory) {
          directory = {
            kind: "directory",
            key,
            name,
            path: path.join("/"),
            children: [],
          };
          directories.set(key, directory);
          children.push(directory);
        }
        children = directory.children;
      }
      if (!isCardHidden(card, column.id, criteria)) children.push(node);
    }
  }
  function pruneAndSort(nodes: CardTreeNode[]): CardTreeNode[] {
    return nodes
      .filter((node) => {
        if (node.kind === "card") return true;
        node.children = pruneAndSort(node.children);
        return node.children.length > 0;
      })
      .sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
        // Stable sort preserves board order when names compare equally.
        return collator.compare(a.name, b.name);
      });
  }
  return { root: pruneAndSort(root), outside };
}
