import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { autoScrollForElements } from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element";
import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import {
  type Board,
  type CardLocation,
  findCardLocation,
} from "../../domain/board.ts";
import type { Card as CardModel } from "../../domain/card.ts";
import {
  useBoardSession,
  useBoardStore,
  useFilterStore,
} from "../context/appContext.ts";
import { resolveCardMoveShortcut } from "../shared/shortcuts/cardMoveShortcut.ts";
import type { CardContextMenuMoveActions } from "../shared/cardContextMenu.ts";
import { buildLabelDisplay } from "../labels/labelDisplay.ts";
import { resolveColumnMove } from "./resolveColumnMove.ts";
import { resolveMove } from "./resolveMove.ts";
import { Column } from "./Column.tsx";
import { AddCardDialog } from "./AddCardDialog.tsx";
import { AddColumn } from "./AddColumn.tsx";
import { describeCardMenuMove, type CardMenuMove } from "./cardMenuMove.ts";
import { resolveCardStep } from "./cardKeyboardMove.ts";
import { describeCardPosition } from "./cardMoveAnnouncement.ts";

const MOVE_ANNOUNCEMENT_DELAY_MS = 500;

interface KeyboardMove {
  cardPath: string;
  focused: Element | null;
}

// Compared by identity, so repeating the same text still announces it again.
interface MoveAnnouncement {
  message: string;
}

interface KanbanBoardProps {
  board: Board;
  onDeleteCard: (card: CardModel) => void;
  onRepairCard: (card: CardModel) => void;
  onCardContextMenu: (card: CardModel, event: MouseEvent<HTMLElement>) => void;
  onOpenCardMenu: (
    card: CardModel,
    trigger: HTMLButtonElement,
    moveActions: CardContextMenuMoveActions,
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
  const { boardStore, filterStore, markdownViewer } = useBoardSession();
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
  const [keyboardMove, setKeyboardMove] = useState<KeyboardMove>();
  const [pendingAnnouncement, setPendingAnnouncement] =
    useState<MoveAnnouncement>();
  const [announcement, setAnnouncement] = useState<MoveAnnouncement>();
  const labelDisplay = useMemo(
    () => buildLabelDisplay(board.labels),
    [board.labels],
  );

  function handleOpenCardMenu(card: CardModel, trigger: HTMLButtonElement) {
    const { moveCardToColumn, moveCardToColumnEdge } = boardStore.getState();
    function reportMove(from: CardLocation | undefined) {
      if (!from) return;
      const nextBoard = boardStore.getState().board;
      if (!nextBoard) return;
      const move = describeCardMenuMove(
        nextBoard,
        card.path,
        from,
        filterStore.getState().criteria,
      );
      if (!move) return;
      setMenuMove(move);
      setPendingAnnouncement({ message: move.message });
    }
    onOpenCardMenu(card, trigger, {
      moveToColumn: (columnId) =>
        reportMove(moveCardToColumn(card.path, columnId)),
      moveToColumnEdge: (expectedColumnId, edge) =>
        reportMove(moveCardToColumnEdge(card.path, expectedColumnId, edge)),
    });
  }

  // Option-Up/Down moves the card selected in the viewer within its column.
  // Everything is read at key time rather than subscribed to, so moving does
  // not re-register this listener.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const direction = resolveCardMoveShortcut(event);
      if (!direction) return;
      // Claimed once recognised, so the keys never fall through to scrolling
      // when the move is declined below.
      event.preventDefault();
      // A held key would carry the card past where the user meant to stop.
      if (event.repeat) return;
      if (document.querySelector("dialog[open]")) return;
      const { selectedPath } = markdownViewer.getState();
      const { board: currentBoard } = boardStore.getState();
      if (!selectedPath || !currentBoard) return;
      const step = resolveCardStep(
        currentBoard,
        selectedPath,
        direction,
        filterStore.getState().criteria,
      );
      if (!step) return;
      const focused = document.activeElement;
      boardStore.getState().moveCard(step.from, step.to);
      const nextBoard = boardStore.getState().board;
      const to = nextBoard && findCardLocation(nextBoard, selectedPath);
      if (!nextBoard || !to) return;
      const card = nextBoard.columns.find((c) => c.id === to.columnId)?.cards[
        to.index
      ];
      const message = describeCardPosition(nextBoard, to);
      if (!card || !message) return;
      setKeyboardMove({ cardPath: card.path, focused });
      setPendingAnnouncement({ message });
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [boardStore, filterStore, markdownViewer]);

  useLayoutEffect(() => {
    const columns = columnsRef.current;
    if (!columns || !keyboardMove) return;
    const { cardPath, focused } = keyboardMove;
    // React reorders a keyed list by reinserting nodes, and reinserting the
    // node that holds focus drops it to the body. Put it back after commit.
    if (
      focused instanceof HTMLElement &&
      focused.isConnected &&
      document.activeElement !== focused
    ) {
      focused.focus({ preventScroll: true });
    }
    Array.from(
      columns.querySelectorAll<HTMLButtonElement>("[data-card-menu-path]"),
    )
      .find((menu) => menu.dataset.cardMenuPath === cardPath)
      ?.closest(".card")
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [keyboardMove]);

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
    // Moving a card can drop focus, so restore it after React commits.
    (button.closest(".card") ?? button).scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
    button.focus({ preventScroll: true });
  }, [menuMove]);

  useEffect(() => {
    if (!pendingAnnouncement) return;
    // Give VoiceOver time to announce the restored focus before the new
    // position. A move within the delay restarts it, so a run of moves
    // announces only the last position.
    const timer = window.setTimeout(
      () => setAnnouncement(pendingAnnouncement),
      MOVE_ANNOUNCEMENT_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [pendingAnnouncement]);

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
        {announcement === pendingAnnouncement ? announcement?.message : ""}
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
