import { useMemo } from "react";
import type { MouseEvent } from "react";
import type { Board } from "../../domain/board.ts";
import type { Card } from "../../domain/card.ts";
import { isCardFileBroken } from "../../domain/card.ts";
import { directoryOf } from "../../domain/boardPath.ts";
import { buildDirectoryTree } from "../../domain/cardDirectoryTree.ts";
import type {
  CardTreeCard,
  DirectoryTreeDirectory,
  DirectoryTreeNode,
} from "../../domain/cardDirectoryTree.ts";
import { isCardFilterActive } from "../../domain/cardFilter.ts";
import { orderCardLabels } from "../../domain/label.ts";
import {
  useBoardStore,
  useBoardView,
  useContextMenu,
  useDirectoryStore,
  useFilterStore,
  useMarkdownViewer,
} from "../context/appContext.ts";
import { buildLabelDisplay } from "../labels/labelDisplay.ts";
import { missingHint } from "../shared/cardFileStateHint.ts";
import { useMenuActions } from "../shared/useMenuActions.ts";
import { buildDirectoryContextMenu } from "./directoryContextMenu.ts";
import { useDirectoryScanning } from "./useDirectoryScanning.ts";

interface CardDirectoryViewProps {
  board: Board;
  onDeleteCard: (card: Card) => void;
  onRepairCard: (card: Card) => void;
  onCardContextMenu: (card: Card, event: MouseEvent<HTMLElement>) => void;
}

export function CardDirectoryView({
  board,
  onDeleteCard,
  onRepairCard,
  onCardContextMenu,
}: CardDirectoryViewProps) {
  const criteria = useFilterStore((state) => state.criteria);
  useDirectoryScanning();
  const expansion = useBoardView((state) => state.directoryExpansion);
  const setExpanded = useBoardView((state) => state.setDirectoryExpanded);
  const snapshots = useDirectoryStore((state) => state.snapshots);
  const scans = useDirectoryStore((state) => state.scans);
  const retry = useDirectoryStore((state) => state.retry);
  const boardPath = useBoardStore((state) => state.path);
  const selectedPath = useMarkdownViewer((state) => state.selectedPath);
  const selectCard = useMarkdownViewer((state) => state.selectCard);
  const contextMenu = useContextMenu();
  const menuActions = useMenuActions();
  const tree = useMemo(
    () => buildDirectoryTree(board, criteria, snapshots),
    [board, criteria, snapshots],
  );
  const labelDisplay = useMemo(
    () => buildLabelDisplay(board.labels),
    [board.labels],
  );

  function openCard(card: Card) {
    if (isCardFileBroken(card)) onRepairCard(card);
    else void selectCard(card);
  }

  function directoryMenu(
    directory: DirectoryTreeDirectory,
    event: MouseEvent<HTMLElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();
    if (boardPath)
      contextMenu.show(
        buildDirectoryContextMenu(
          directory,
          directoryOf(boardPath),
          menuActions,
        ),
      );
  }

  function renderCard({ card, column, name }: CardTreeCard) {
    const selected = selectedPath === card.path;
    return (
      <li key={`card:${card.path}`}>
        <div
          className={`card-directory__row${selected ? " card-directory__row--selected" : ""}`}
          onClick={() => openCard(card)}
          onContextMenu={(event) => onCardContextMenu(card, event)}
        >
          <button
            type="button"
            className="card-directory__open"
            title={card.path}
            aria-current={selected ? "true" : undefined}
            onClick={(event) => {
              event.stopPropagation();
              openCard(card);
            }}
          >
            <span className="card-directory__filename">
              <span className="card-directory__name">{name}</span>
              {isCardFileBroken(card) && (
                <span
                  className="card__missing"
                  title={missingHint(card.fileState)}
                >
                  Missing
                </span>
              )}
            </span>
            {card.displayTitle !== name.replace(/\.md$/, "") && (
              <span className="card-directory__subtitle">
                {card.displayTitle}
              </span>
            )}
          </button>
          <span className="card-directory__column">{column.name}</span>
          <div className="card__labels">
            {orderCardLabels(card.labels, labelDisplay.positions).map(
              (label) => (
                <span
                  key={label}
                  className={`card__label card__label--${labelDisplay.colors.get(label) ?? "neutral"}`}
                >
                  {label}
                </span>
              ),
            )}
          </div>
          <button
            type="button"
            className="card-directory__delete"
            aria-label={`Delete ${card.displayTitle}`}
            title="Delete card"
            onClick={(event) => {
              event.stopPropagation();
              onDeleteCard(card);
            }}
          >
            ×
          </button>
        </div>
      </li>
    );
  }

  const filtered = isCardFilterActive(board, criteria);
  function scanStatus(key: string) {
    if (filtered) return null;
    const scan = scans.get(key);
    if (!scan || scan.status === "loading")
      return (
        <p className="card-directory__status" role="status">
          Loading files…
        </p>
      );
    if (scan.status === "failed")
      return (
        <div className="card-directory__error" role="alert">
          {scan.message}{" "}
          <button type="button" onClick={() => retry(key)}>
            Retry
          </button>
        </div>
      );
    return null;
  }

  function renderNodes(nodes: DirectoryTreeNode[]) {
    return (
      <ul>
        {nodes.map((node) => {
          if (node.kind === "card") return renderCard(node);
          if (node.kind === "file")
            return (
              <li key={`file:${node.path}`}>
                <div
                  className="card-directory__row card-directory__file"
                  title={node.path}
                >
                  <span className="card-directory__name">{node.name}</span>
                  <span className="card-directory__unregistered">
                    Not on board
                  </span>
                </div>
              </li>
            );
          const expanded = expansion.get(node.key) ?? node.hasCardDescendants;
          return (
            <li key={`directory:${node.key}`}>
              <button
                type="button"
                className="card-directory__directory"
                aria-expanded={expanded}
                onClick={() => setExpanded(node.key, !expanded)}
                onContextMenu={(event) => directoryMenu(node, event)}
              >
                <span aria-hidden="true">{expanded ? "▾" : "▸"}</span>{" "}
                {node.name}
              </button>
              {expanded && (
                <>
                  {scanStatus(node.key)}
                  {renderNodes(node.children)}
                </>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  const empty = tree.root.length === 0 && tree.outside.length === 0;
  const rootScan = scans.get("");
  return (
    <div className="card-directory" role="region" aria-label="Files">
      {scanStatus("")}
      {tree.root.length > 0 && renderNodes(tree.root)}
      {tree.outside.length > 0 && (
        <section aria-label="Outside board directory">
          <h2 className="card-directory__outside">Outside board directory</h2>
          <ul>{tree.outside.map(renderCard)}</ul>
        </section>
      )}
      {empty && (filtered || rootScan?.status === "scanned") && (
        <p className="card-directory__empty">
          {filtered
            ? "No cards match the filter."
            : "No Markdown files or directories."}
        </p>
      )}
    </div>
  );
}
