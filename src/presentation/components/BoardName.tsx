import { useState } from "react";

interface BoardNameProps {
  name: string;
  onRename: (name: string) => void;
}

// Inline rename with the same rules as ColumnHeader: Enter/blur commits,
// Escape cancels, and the committed value is trimmed. Editing state stays
// local; only the committed name reaches the store.
// Callers must key this component by board identity (KanbanBoard keys it by
// the board path): without a key, an edit in progress would survive a board
// switch and Enter/blur would rename the newly opened board with the
// previous board's draft.
export function BoardName({ name, onRename }: BoardNameProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");

  function startEditing() {
    setDraft(name);
    setIsEditing(true);
  }

  function commit() {
    setIsEditing(false);
    const trimmed = draft.trim();
    // A blank name reverts silently instead of erroring: inline editing has
    // no room for a validation message, and reverting loses nothing.
    if (trimmed === "" || trimmed === name) return;
    onRename(trimmed);
  }

  if (isEditing) {
    return (
      <input
        className="kanban-board__name-input"
        type="text"
        value={draft}
        aria-label="Board name"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
          // Escape unmounts the input before its blur handler could run,
          // so the draft is discarded without committing.
          if (event.key === "Escape") setIsEditing(false);
        }}
        onFocus={(event) => event.currentTarget.select()}
        autoFocus
      />
    );
  }

  return (
    <h1 className="kanban-board__name">
      <button
        type="button"
        className="kanban-board__name-button"
        title={name}
        onClick={startEditing}
      >
        {name}
      </button>
    </h1>
  );
}
