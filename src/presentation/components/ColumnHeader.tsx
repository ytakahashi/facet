import type { RefObject } from "react";
import { useState } from "react";
import type { Column as ColumnModel } from "../../domain/board.ts";

interface ColumnHeaderProps {
  column: ColumnModel;
  dragHandleRef: RefObject<HTMLSpanElement | null>;
  onAddCard: (columnId: string) => void;
  onRename: (columnId: string, name: string) => void;
  onRemove: (columnId: string) => void;
}

export function ColumnHeader({
  column,
  dragHandleRef,
  onAddCard,
  onRename,
  onRemove,
}: ColumnHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const canRemove = column.cards.length === 0;

  function startEditing() {
    setDraft(column.name);
    setIsEditing(true);
  }

  function commit() {
    setIsEditing(false);
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
          <input
            className="column__name-input"
            type="text"
            value={draft}
            aria-label="Column name"
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
        )
        : (
          <h2 className="column__name">
            <button
              type="button"
              className="column__name-button"
              title={column.name}
              onClick={startEditing}
            >
              {column.name}
            </button>
          </h2>
        )}
      <div className="column__actions">
        <button
          type="button"
          className="column__add-card"
          onClick={() => onAddCard(column.id)}
        >
          + Add card
        </button>
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
