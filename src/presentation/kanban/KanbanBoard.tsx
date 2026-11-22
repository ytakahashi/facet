import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { autoScrollForElements } from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element";
import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import type { Board } from "../../domain/board.ts";
import type { Card as CardModel } from "../../domain/card.ts";
import {
  useBoardSession,
  useBoardStore,
  useFilterStore,
} from "../context/appContext.ts";
import { buildLabelDisplay } from "../labels/labelDisplay.ts";
import { resolveColumnMove } from "./resolveColumnMove.ts";
import { resolveMove } from "./resolveMove.ts";
import { Column } from "./Column.tsx";
import { AddCardDialog } from "./AddCardDialog.tsx";
import { AddColumn } from "./AddColumn.tsx";
import { describeCardMenuMove, type CardMenuMove } from "./cardMenuMove.ts";

const MOVE_ANNOUNCEMENT_DELAY_MS = 500;

interface KanbanBoardProps {
  board: Board;
  onDeleteCard: (card: CardModel) => void;
  onRepairCard: (card: CardModel) => void;
  onCardContextMenu: (card: CardModel, event: MouseEvent<HTMLElement>) => void;
  onOpenCardMenu: (
    card: CardModel,
    trigger: HTMLButtonElement,
    moveToColumn: (columnId: string) => void,
  ) => void;
}

export function KanbanBoard({
  board,
  onDeleteCard,
  onRepairCard,
  onCardContextMenu,
  onOpenCardMenu,
}: KanbanBoardProps) {
  const columnsRef = useRef<HTMLDivElement>(null);
  const { boardStore, filterStore } = useBoardSession();
  const moveCard = useBoardStore((state) => state.moveCard);
  const moveColumn = useBoardStore((state) => state.moveColumn);
  const renameColumn = useBoardStore((state) => state.renameColumn);
  const removeColumn = useBoardStore((state) => state.removeColumn);
  const boardPath = useBoardStore((state) => state.path);
  const criteria = useFilterStore((state) => state.criteria);
  // Keep the last-targeted column around after closing so the dialog stays
  // mounted and its `open` prop can toggle through a real dialog.close() —
  // unmounting on every close bypasses the browser's native focus restore.
  const [addToColumnId, setAddToColumnId] = useState<string>();
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);
  const [menuMove, setMenuMove] = useState<CardMenuMove>();
  const [announcedMove, setAnnouncedMove] = useState<CardMenuMove>();
  const labelDisplay = useMemo(
    () => buildLabelDisplay(board.labels),
    [board.labels],
  );

  function handleOpenCardMenu(card: CardModel, trigger: HTMLButtonElement) {
    onOpenCardMenu(card, trigger, (columnId) => {
      const from = boardStore.getState().moveCardToColumn(card.path, columnId);
      if (!from) return;
      const nextBoard = boardStore.getState().board;
      if (!nextBoard) return;
      const move = describeCardMenuMove(
        nextBoard,
        card.path,
        from,
        filterStore.getState().criteria,
      );
      if (move) setMenuMove(move);
    });
  }

  useLayoutEffect(() => {
    const columns = columnsRef.current;
    if (!columns || !menuMove) return;
    const cardMenus = Array.from(
      columns.querySelectorAll<HTMLButtonElement>("[data-card-menu-path]"),
    );
    const sourceColumn = Array.from(
      columns.querySelectorAll<HTMLElement>("[data-column-id]"),
    ).find((column) => column.dataset.columnId === menuMove.sourceColumnId);
    const button =
      cardMenus.find(
        (menu) => menu.dataset.cardMenuPath === menuMove.cardPath,
      ) ??
      cardMenus.find(
        (menu) => menu.dataset.cardMenuPath === menuMove.fallbackCardPath,
      ) ??
      sourceColumn?.querySelector<HTMLButtonElement>(".column__add-card");
    if (!button) return;
    // Cards remount across columns, so restore focus after React commits.
    (button.closest(".card") ?? button).scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
    button.focus({ preventScroll: true });
  }, [menuMove]);

  useEffect(() => {
    if (!menuMove) return;
    // Give VoiceOver time to announce the restored focus before the new position.
    const timer = window.setTimeout(
      () => setAnnouncedMove(menuMove),
      MOVE_ANNOUNCEMENT_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [menuMove]);

  // Dragging near an edge scrolls the column row, so a card can be carried to
  // a destination that is off-screen when the drag starts. That row is the
  // board's only scrolling region (see App.css), so registering it covers both
  // axes. No canScroll filter is passed: every drag may scroll it.
  useEffect(() => {
    const columnsElement = columnsRef.current;
    if (!columnsElement) return;

    return autoScrollForElements({ element: columnsElement });
  }, []);

  // One monitor for both kinds of drag. Each resolver ignores the other's
  // source type, so the order they are tried in carries no meaning.
  useEffect(() => {
    return monitorForElements({
      onDrop({ source, location }) {
        const dropTargets = location.current.dropTargets;
        const move = resolveMove(source, dropTargets);
        if (move) {
          moveCard(move.from, move.to);
          return;
        }
        const columnMove = resolveColumnMove(source, dropTargets);
        if (columnMove) moveColumn(columnMove.columnId, columnMove.toIndex);
      },
    });
  }, [moveCard, moveColumn]);

  // A fragment rather than a wrapper: the column row has to stay a direct flex
  // child of .board-screen to get the pane's remaining height (see App.css).
  return (
    <>
      <div ref={columnsRef} className="kanban-board__columns">
        {board.columns.map((column, index) => (
          <Column
            column={column}
            criteria={criteria}
            index={index}
            key={column.id}
            labelDisplay={labelDisplay}
            onAddCard={(columnId) => {
              setAddToColumnId(columnId);
              setIsAddCardOpen(true);
            }}
            onDeleteCard={onDeleteCard}
            onRepairCard={onRepairCard}
            onCardContextMenu={onCardContextMenu}
            onOpenCardMenu={handleOpenCardMenu}
            onRename={renameColumn}
            onRemove={removeColumn}
          />
        ))}
        <AddColumn />
      </div>
      <div className="kanban-board__move-status" role="status">
        {announcedMove === menuMove ? announcedMove?.message : ""}
      </div>
      {boardPath && addToColumnId && (
        <AddCardDialog
          boardPath={boardPath}
          columnId={addToColumnId}
          open={isAddCardOpen}
          onClose={() => setIsAddCardOpen(false)}
        />
      )}
    </>
  );
}
