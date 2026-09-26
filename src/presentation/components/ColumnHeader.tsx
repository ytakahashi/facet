import type { RefObject } from "react";
import { useState } from "react";
import type { Column as ColumnModel } from "../../domain/board.ts";

interface ColumnHeaderProps {
  column: ColumnModel;
  dragHandleRef: RefObject<HTMLSpanElement | null>;
  // Held by the column rather than here: its context menu starts a rename too.
  isEditing: boolean;
  onEditingChange: (isEditing: boolean) => void;
  onRename: (columnId: string, name: string) => void;
  onRemove: (columnId: string) => void;
}

export function ColumnHeader({
  column,
  dragHandleRef,
  isEditing,
  onEditingChange,
  onRename,
  onRemove,
}: ColumnHeaderProps) {
  const canRemove = column.cards.length === 0;

  function commit(draft: string) {
    onEditingChange(false);
    const trimmed = draft.trim();
    // A blank name reverts silently instead of erroring: inline editing has
    // no room for a validation message, and reverting loses nothing.
    if (trimmed === "" || trimmed === column.name) return;
    onRename(column.id, trimmed);
  }

  return (
    <div className="column__header">
      {
        /* Dragging the column starts here rather than anywhere on the column:
          cards are draggable inside it, and the rename input must keep its own
          text selection. Deliberately not a button - it only responds to a
          pointer drag, and a focusable control that ignores Enter would
          promise a keyboard interaction that does not exist. The column
          registers this element as its drag handle (see Column.tsx). */
      }
      <span
        ref={dragHandleRef}
        className="column__drag-handle"
        title="Drag to reorder"
        aria-hidden="true"
      >
        ⠿
      </span>
      {isEditing
        ? (
          <ColumnNameInput
            initialName={column.name}
            onCommit={commit}
            onCancel={() => onEditingChange(false)}
          />
        )
        : (
          <h2 className="column__name">
            <button
              type="button"
              className="column__name-button"
              title={column.name}
              onClick={() => onEditingChange(true)}
            >
              {column.name}
            </button>
          </h2>
        )}
      <div className="column__actions">
        <button
          type="button"
          aria-label="Delete column"
          disabled={!canRemove}
          title={canRemove ? "Delete column" : "Move cards out first"}
          onClick={() => onRemove(column.id)}
        >
          ×
        </button>
      </div>
    </div>
  );
}

interface ColumnNameInputProps {
  initialName: string;
  onCommit: (draft: string) => void;
  onCancel: () => void;
}

// Mounted afresh for every edit, so the draft starts from the name the column
// has at that moment without an effect to reset it.
function ColumnNameInput(
  { initialName, onCommit, onCancel }: ColumnNameInputProps,
) {
  const [draft, setDraft] = useState(initialName);

  return (
    <input
      className="column__name-input"
      type="text"
      value={draft}
      aria-label="Column name"
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => onCommit(draft)}
      onKeyDown={(event) => {
        if (event.key === "Enter") onCommit(draft);
        // Escape unmounts the input before its blur handler could run, so the
        // draft is discarded without committing.
        if (event.key === "Escape") onCancel();
      }}
      onFocus={(event) => event.currentTarget.select()}
      autoFocus
    />
  );
}
