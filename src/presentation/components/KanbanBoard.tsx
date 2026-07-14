import { useEffect } from "react";
import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import type { Board } from "../../domain/board.ts";
import { useBoardStore } from "../context/appContext.ts";
import { resolveMove } from "./resolveMove.ts";
import { Column } from "./Column.tsx";

export function KanbanBoard({ board }: { board: Board }) {
  const moveCard = useBoardStore((state) => state.moveCard);
  const saveError = useBoardStore((state) => state.saveError);
  const retrySave = useBoardStore((state) => state.retrySave);

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
      <h1 className="kanban-board__name">{board.name}</h1>
      {saveError && (
        <div className="kanban-board__save-error" role="alert">
          <span>Failed to save board: {saveError}</span>
          <button type="button" onClick={retrySave}>Retry</button>
        </div>
      )}
      <div className="kanban-board__columns">
        {board.columns.map((column) => (
          <Column column={column} key={column.id} />
        ))}
      </div>
    </div>
  );
}
