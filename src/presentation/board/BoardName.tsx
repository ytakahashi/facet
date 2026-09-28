import { useState } from "react";

interface BoardNameProps {
  name: string;
  onRename: (name: string) => void;
}

// Inline rename with the same rules as ColumnHeader: Enter/blur commits,
// Escape cancels, and the committed value is trimmed. Editing state stays
// local; only the committed name reaches the store.
// BoardSessionProvider is keyed by tab identity, so an edit in progress cannot
// survive a board switch and rename another board with the previous draft.
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
        className="board-screen__name-input"
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
    <h1 className="board-screen__name">
      <button
        type="button"
        className="board-screen__name-button"
        title={name}
        onClick={startEditing}
      >
        {name}
      </button>
    </h1>
  );
}
