import type { BoardViewMode } from "../store/boardViewStore.ts";

interface ViewSwitcherProps {
  mode: BoardViewMode;
  onChange: (mode: BoardViewMode) => void;
}

export function ViewSwitcher({ mode, onChange }: ViewSwitcherProps) {
  return (
    <div className="view-switcher" role="group" aria-label="View">
      <button
        type="button"
        aria-pressed={mode === "board"}
        onClick={() => onChange("board")}
      >
        Board
      </button>
      <button
        type="button"
        aria-pressed={mode === "table"}
        onClick={() => onChange("table")}
      >
        Table
      </button>
    </div>
  );
}
