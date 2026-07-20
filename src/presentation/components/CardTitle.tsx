import { useState } from "react";
import type { Card } from "../../domain/card.ts";

interface CardTitleProps {
  card: Card;
  onRename: (path: string, title: string) => void;
}

// Inline rename with the same rules as ColumnHeader/BoardName: Enter/blur
// commits, Escape cancels, and the committed value is trimmed. Editing state
// stays local; only the committed title reaches the store.
// Callers must key this component by card identity (MarkdownViewer keys it
// by the card's path): without a key, an edit in progress would survive a
// card switch and Enter/blur would rename the newly opened card with the
// previous card's draft.
export function CardTitle({ card, onRename }: CardTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");

  function startEditing() {
    setDraft(card.displayTitle);
    setIsEditing(true);
  }

  function commit() {
    setIsEditing(false);
    const trimmed = draft.trim();
    // A blank title reverts silently instead of erroring: inline editing has
    // no room for a validation message, and reverting loses nothing.
    if (trimmed === "" || trimmed === card.displayTitle) return;
    onRename(card.path, trimmed);
  }

  if (isEditing) {
    return (
      <input
        className="markdown-viewer__title-input"
        type="text"
        value={draft}
        aria-label="Card title"
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
    <h2 className="markdown-viewer__title">
      <button
        type="button"
        className="markdown-viewer__title-button"
        title={card.displayTitle}
        onClick={startEditing}
      >
        {card.displayTitle}
      </button>
    </h2>
  );
}
