import type { Board } from "../../domain/board.ts";
import { Column } from "./Column.tsx";

export function KanbanBoard({ board }: { board: Board }) {
  return (
    <div className="kanban-board">
      <h1 className="kanban-board__name">{board.name}</h1>
      <div className="kanban-board__columns">
        {board.columns.map((column) => (
          <Column column={column} key={column.id} />
        ))}
      </div>
    </div>
  );
}
