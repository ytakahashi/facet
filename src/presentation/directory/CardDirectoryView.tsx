import { useMemo } from "react";
import type { MouseEvent } from "react";
import type { Board } from "../../domain/board.ts";
import type { Card } from "../../domain/card.ts";
import { isCardFileBroken } from "../../domain/card.ts";
import { directoryOf } from "../../domain/boardPath.ts";
import { buildCardDirectoryTree } from "../../domain/cardDirectoryTree.ts";
import type {
  CardTreeCard,
  CardTreeDirectory,
  CardTreeNode,
} from "../../domain/cardDirectoryTree.ts";
import { orderCardLabels } from "../../domain/label.ts";
import {
  useBoardStore,
  useBoardView,
  useContextMenu,
  useFilterStore,
  useMarkdownViewer,
} from "../context/appContext.ts";
import { buildLabelDisplay } from "../labels/labelDisplay.ts";
import { missingHint } from "../shared/cardFileStateHint.ts";
import { useMenuActions } from "../shared/useMenuActions.ts";
import { buildDirectoryContextMenu } from "./directoryContextMenu.ts";

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
  const collapsed = useBoardView((state) => state.collapsedDirectories);
  const toggleDirectory = useBoardView((state) => state.toggleDirectory);
  const boardPath = useBoardStore((state) => state.path);
  const selectedPath = useMarkdownViewer((state) => state.selectedPath);
  const selectCard = useMarkdownViewer((state) => state.selectCard);
  const contextMenu = useContextMenu();
  const menuActions = useMenuActions();
  const tree = useMemo(
    () => buildCardDirectoryTree(board, criteria),
    [board, criteria],
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
    directory: CardTreeDirectory,
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

  function renderNodes(nodes: CardTreeNode[]) {
    return (
      <ul>
        {nodes.map((node) => {
          if (node.kind === "card") return renderCard(node);
          const expanded = !collapsed.has(node.key);
          return (
            <li key={`directory:${node.key}`}>
              <button
                type="button"
                className="card-directory__directory"
                aria-expanded={expanded}
                onClick={() => toggleDirectory(node.key)}
                onContextMenu={(event) => directoryMenu(node, event)}
              >
                <span aria-hidden="true">{expanded ? "▾" : "▸"}</span>{" "}
                {node.name}
              </button>
              {expanded && renderNodes(node.children)}
            </li>
          );
        })}
      </ul>
    );
  }

  const empty = tree.root.length === 0 && tree.outside.length === 0;
  const hasCards = board.columns.some((column) => column.cards.length > 0);
  return (
    <div className="card-directory" role="region" aria-label="Files">
      {tree.root.length > 0 && renderNodes(tree.root)}
      {tree.outside.length > 0 && (
        <section aria-label="Outside board directory">
          <h2 className="card-directory__outside">Outside board directory</h2>
          <ul>{tree.outside.map(renderCard)}</ul>
        </section>
      )}
      {empty && (
        <p className="card-directory__empty">
          {hasCards
            ? "No cards match the filter."
            : "No cards yet. Add cards from the Board view."}
        </p>
      )}
    </div>
  );
}
