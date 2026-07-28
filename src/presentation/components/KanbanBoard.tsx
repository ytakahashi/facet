import { useEffect, useMemo, useRef, useState } from "react";
import { autoScrollForElements } from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element";
import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import type { Board } from "../../domain/board.ts";
import type { Card as CardModel } from "../../domain/card.ts";
import type { LabelColor } from "../../domain/label.ts";
import { useBoardStore, useFilterStore } from "../context/appContext.ts";
import { resolveMove } from "./resolveMove.ts";
import { Column } from "./Column.tsx";
import { AddCardDialog } from "./AddCardDialog.tsx";
import { AddColumn } from "./AddColumn.tsx";
import { BoardName } from "./BoardName.tsx";
import { DeleteCardDialog } from "./DeleteCardDialog.tsx";

export function KanbanBoard({ board }: { board: Board }) {
  const columnsRef = useRef<HTMLDivElement>(null);
  const moveCard = useBoardStore((state) => state.moveCard);
  const renameBoard = useBoardStore((state) => state.renameBoard);
  const renameColumn = useBoardStore((state) => state.renameColumn);
  const removeColumn = useBoardStore((state) => state.removeColumn);
  const saveError = useBoardStore((state) => state.saveError);
  const retrySave = useBoardStore((state) => state.retrySave);
  const boardPath = useBoardStore((state) => state.path);
  const criteria = useFilterStore((state) => state.criteria);
  // Keep the last-targeted column around after closing so the dialog stays
  // mounted and its `open` prop can toggle through a real dialog.close() —
  // unmounting on every close bypasses the browser's native focus restore.
  const [addToColumnId, setAddToColumnId] = useState<string>();
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);
  // Kept after closing for the same reason as addToColumnId. Holding the card
  // itself rather than its path keeps the dialog renderable in the moment
  // between a successful delete and the close taking effect.
  const [deleteTarget, setDeleteTarget] = useState<CardModel>();
  const [isDeleteCardOpen, setIsDeleteCardOpen] = useState(false);
  // Built once per registry change and threaded down to Card, rather than
  // having every Card re-scan board.labels itself for each of its labels.
  const labelColors = useMemo(
    () =>
      new Map<string, LabelColor>(
        board.labels.map((label) => [label.name, label.color]),
      ),
    [board.labels],
  );

  useEffect(() => {
    // A board can change in-place through Open Recent. Never carry a dialog
    // target from the previous board into the newly loaded board.
    setIsAddCardOpen(false);
    setAddToColumnId(undefined);
    setIsDeleteCardOpen(false);
    setDeleteTarget(undefined);
  }, [boardPath]);

  // Dragging near an edge scrolls the column row, so a card can be carried to
  // a destination that is off-screen when the drag starts. That row is the
  // board's only scrolling region (see App.css), so registering it covers both
  // axes. No canScroll filter is passed: every drag may scroll it.
  useEffect(() => {
    const columnsElement = columnsRef.current;
    if (!columnsElement) return;

    return autoScrollForElements({ element: columnsElement });
  }, []);

  useEffect(() => {
    return monitorForElements({
      onDrop({ source, location }) {
        const move = resolveMove(source, location.current.dropTargets);
        if (move) moveCard(move.from, move.to);
      },
    });
  }, [moveCard]);

  return (
    <div className="kanban-board">
      {
        /* Keyed by path so switching boards (e.g. Open Recent) discards any
          in-progress name edit instead of committing it to the new board. */
      }
      <BoardName key={boardPath} name={board.name} onRename={renameBoard} />
      {saveError && (
        <div className="kanban-board__save-error" role="alert">
          <span>Failed to save board: {saveError}</span>
          <button type="button" onClick={retrySave}>Retry</button>
        </div>
      )}
      <div ref={columnsRef} className="kanban-board__columns">
        {board.columns.map((column) => (
          <Column
            column={column}
            criteria={criteria}
            key={column.id}
            labelColors={labelColors}
            onAddCard={(columnId) => {
              setAddToColumnId(columnId);
              setIsAddCardOpen(true);
            }}
            onDeleteCard={(card) => {
              setDeleteTarget(card);
              setIsDeleteCardOpen(true);
            }}
            onRename={renameColumn}
            onRemove={removeColumn}
          />
        ))}
        <AddColumn />
      </div>
      {boardPath && addToColumnId && (
        <AddCardDialog
          boardPath={boardPath}
          columnId={addToColumnId}
          open={isAddCardOpen}
          onClose={() => setIsAddCardOpen(false)}
        />
      )}
      {deleteTarget && (
        <DeleteCardDialog
          card={deleteTarget}
          open={isDeleteCardOpen}
          onClose={() => setIsDeleteCardOpen(false)}
        />
      )}
    </div>
  );
}
