import { useEffect, useMemo, useState } from "react";
import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import type { Board } from "../../domain/board.ts";
import type { LabelColor } from "../../domain/label.ts";
import { useBoardStore } from "../context/appContext.ts";
import { resolveMove } from "./resolveMove.ts";
import { Column } from "./Column.tsx";
import { AddCardDialog } from "./AddCardDialog.tsx";
import { AddColumn } from "./AddColumn.tsx";
import { BoardName } from "./BoardName.tsx";

export function KanbanBoard({ board }: { board: Board }) {
  const moveCard = useBoardStore((state) => state.moveCard);
  const renameBoard = useBoardStore((state) => state.renameBoard);
  const renameColumn = useBoardStore((state) => state.renameColumn);
  const removeColumn = useBoardStore((state) => state.removeColumn);
  const saveError = useBoardStore((state) => state.saveError);
  const retrySave = useBoardStore((state) => state.retrySave);
  const boardPath = useBoardStore((state) => state.path);
  // Keep the last-targeted column around after closing so the dialog stays
  // mounted and its `open` prop can toggle through a real dialog.close() —
  // unmounting on every close bypasses the browser's native focus restore.
  const [addToColumnId, setAddToColumnId] = useState<string>();
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);
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
  }, [boardPath]);

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
      <div className="kanban-board__columns">
        {board.columns.map((column) => (
          <Column
            column={column}
            key={column.id}
            labelColors={labelColors}
            onAddCard={(columnId) => {
              setAddToColumnId(columnId);
              setIsAddCardOpen(true);
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
    </div>
  );
}
