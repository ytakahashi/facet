import type { Board, Column } from "./board.ts";
import type { Card } from "./card.ts";
import type { CardFilterCriteria } from "./cardFilter.ts";
import {
  EMPTY_CARD_FILTER,
  isCardFilterActive,
  isCardHidden,
} from "./cardFilter.ts";
import type { DirEntry } from "./fileSystemPort.ts";
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

export interface CardTreeFile {
  kind: "file";
  name: string;
  path: string;
}

// Keep the card-only model separate so its consumers never receive file nodes.
export interface DirectoryTreeDirectory extends Omit<
  CardTreeDirectory,
  "children"
> {
  // Counts every card beneath it, hidden or not; drives default expansion.
  hasCardDescendants: boolean;
  children: DirectoryTreeNode[];
}

export type DirectoryTreeNode =
  | DirectoryTreeDirectory
  | CardTreeCard
  | CardTreeFile;

export interface DirectoryTree {
  root: DirectoryTreeNode[];
  outside: CardTreeCard[];
}

// Keys are folded board-relative directory paths; "" names the board root.
// Each value replaces that directory's entire listing, including an empty one.
export type DirectorySnapshots = ReadonlyMap<string, readonly DirEntry[]>;

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

export function buildDirectoryTree(
  board: Board,
  criteria: CardFilterCriteria,
  snapshots: DirectorySnapshots,
): DirectoryTree {
  // Match against every card before filtering: a hidden card is still registered.
  const cards = buildCardDirectoryTree(board, EMPTY_CARD_FILTER);
  const filtered = isCardFilterActive(board, criteria);

  function merge(
    cardNodes: CardTreeNode[],
    directoryKey: string,
    directoryPath: string,
  ): DirectoryTreeNode[] {
    const directories = new Map<string, CardTreeDirectory>();
    const cardFiles: CardTreeCard[] = [];
    const registered = new Set<string>();
    const unregistered = new Map<string, CardTreeFile>();
    // A hand-edited board may list one file twice; keep every card row.
    for (const node of cardNodes) {
      if (node.kind === "directory") directories.set(node.key, node);
      else {
        cardFiles.push(node);
        registered.add(pathSegmentKey(node.name));
      }
    }

    if (!filtered) {
      // Resolve collator ties independently of the host's directory enumeration.
      const entries = [...(snapshots.get(directoryKey) ?? [])].sort((a, b) =>
        a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
      );
      for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;
        const segmentKey = pathSegmentKey(entry.name);
        const key = directoryKey ? `${directoryKey}/${segmentKey}` : segmentKey;
        const path = directoryPath
          ? `${directoryPath}/${entry.name}`
          : entry.name;
        if (entry.isDirectory) {
          if (!directories.has(key))
            directories.set(key, {
              kind: "directory",
              key,
              name: entry.name,
              path,
              children: [],
            });
        } else if (
          /\.md$/i.test(entry.name) &&
          !registered.has(segmentKey) &&
          !unregistered.has(segmentKey)
        ) {
          unregistered.set(segmentKey, {
            kind: "file",
            name: entry.name,
            path,
          });
        }
      }
    }

    const nodes: DirectoryTreeNode[] = [];
    for (const directory of directories.values()) {
      const children = merge(directory.children, directory.key, directory.path);
      if (filtered && children.length === 0) continue;
      nodes.push({
        ...directory,
        // Determine the default expansion from the unfiltered card tree.
        hasCardDescendants: directory.children.length > 0,
        children,
      });
    }
    for (const node of cardFiles) {
      if (!isCardHidden(node.card, node.column.id, criteria)) nodes.push(node);
    }
    nodes.push(...unregistered.values());
    return nodes.sort((a, b) => {
      if ((a.kind === "directory") !== (b.kind === "directory"))
        return a.kind === "directory" ? -1 : 1;
      // Stable sorting keeps card ties in board order and FS ties in name order.
      return collator.compare(a.name, b.name);
    });
  }

  return {
    root: merge(cards.root, "", ""),
    outside: cards.outside.filter(
      (node) => !isCardHidden(node.card, node.column.id, criteria),
    ),
  };
}
