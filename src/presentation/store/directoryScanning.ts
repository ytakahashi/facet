import type { BoardSession } from "../context/appContext.ts";
import { directoryOf } from "../../domain/boardPath.ts";
import { buildDirectoryTree } from "../../domain/cardDirectoryTree.ts";
import type { DirectoryTreeNode } from "../../domain/cardDirectoryTree.ts";
import { isCardFilterActive } from "../../domain/cardFilter.ts";

// Runs only while Files is mounted. Subscriptions make scheduling independent
// of React rendering, including collapse events before a queued read starts.
export function startDirectoryScanning(session: BoardSession): () => void {
  const { boardStore, boardView, filterStore, directoryStore, fileAddition } =
    session;
  function updateTargets() {
    const { board } = boardStore.getState();
    if (!board) return;
    const { criteria } = filterStore.getState();
    if (isCardFilterActive(board, criteria)) {
      directoryStore.getState().setTargets(new Map());
      return;
    }
    const tree = buildDirectoryTree(
      board,
      criteria,
      directoryStore.getState().snapshots,
    );
    const { directoryExpansion } = boardView.getState();
    const targets = new Map([["", ""]]);
    function visit(nodes: DirectoryTreeNode[]) {
      for (const node of nodes) {
        if (node.kind !== "directory") continue;
        if (!(directoryExpansion.get(node.key) ?? node.hasCardDescendants))
          continue;
        targets.set(node.key, node.path);
        visit(node.children);
      }
    }
    visit(tree.root);
    directoryStore.getState().setTargets(targets);
  }
  function begin() {
    const { path } = boardStore.getState();
    if (!path) return;
    directoryStore.getState().begin(directoryOf(path) || "/");
    // Earlier failures may no longer hold once the listings are reread.
    fileAddition.getState().clearFailures();
    updateTargets();
  }
  begin();
  const unsubscribes = [
    boardStore.subscribe((state, previous) => {
      if (
        state.loadGeneration !== previous.loadGeneration ||
        state.path !== previous.path
      )
        begin();
      else if (state.board !== previous.board) updateTargets();
    }),
    boardView.subscribe(updateTargets),
    filterStore.subscribe(updateTargets),
    directoryStore.subscribe((state, previous) => {
      if (state.snapshots !== previous.snapshots) updateTargets();
    }),
  ];
  return () => {
    unsubscribes.forEach((unsubscribe) => unsubscribe());
    directoryStore.getState().stop();
  };
}
