import { useState } from "react";
import { findCardByPath } from "../../domain/board.ts";
import { useBoardStore, useMarkdownViewer } from "../context/appContext.ts";
import { isCardSaving, isMarkdownDirty } from "../store/markdownViewerStore.ts";
import { CardTitle } from "./CardTitle.tsx";
import { LabelPickerDialog } from "./LabelPickerDialog.tsx";
import { MarkdownEditor } from "./MarkdownEditor.tsx";
import { PriorityPicker } from "./PriorityPicker.tsx";

export function MarkdownViewer() {
  const status = useMarkdownViewer((state) => state.status);
  const selectedPath = useMarkdownViewer((state) => state.selectedPath);
  const draft = useMarkdownViewer((state) => state.draft);
  const isDirty = useMarkdownViewer(isMarkdownDirty);
  const error = useMarkdownViewer((state) => state.error);
  // Scoped to the open card: a write still running for a card the user has
  // since navigated away from must not label this card's button "Saving…".
  const isSaving = useMarkdownViewer((state) =>
    state.selectedPath !== undefined &&
    isCardSaving(state, state.selectedPath)
  );
  const saveError = useMarkdownViewer((state) => state.saveError);
  const updateDraft = useMarkdownViewer((state) => state.updateDraft);
  const save = useMarkdownViewer((state) => state.save);
  const close = useMarkdownViewer((state) => state.close);

  const board = useBoardStore((state) => state.board);
  const renameCard = useBoardStore((state) => state.renameCard);
  const setCardPriority = useBoardStore((state) => state.setCardPriority);
  const addCardLabel = useBoardStore((state) => state.addCardLabel);
  const removeCardLabel = useBoardStore((state) => state.removeCardLabel);
  const createLabel = useBoardStore((state) => state.createLabel);
  const renameLabel = useBoardStore((state) => state.renameLabel);
  const setLabelColor = useBoardStore((state) => state.setLabelColor);
  const removeLabel = useBoardStore((state) => state.removeLabel);
  const card = status === "loaded" && board && selectedPath
    ? findCardByPath(board, selectedPath)
    : undefined;

  const [isLabelPickerOpen, setIsLabelPickerOpen] = useState(false);

  return (
    <div className="markdown-viewer">
      <div className="markdown-viewer__header">
        {card && (
          <CardTitle
            key={card.path}
            card={card}
            onRename={renameCard}
          />
        )}
        <div className="markdown-viewer__header-actions">
          <button
            type="button"
            onClick={save}
            disabled={!isDirty || isSaving}
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={close}>Close</button>
        </div>
      </div>

      {card && (
        <div className="markdown-viewer__meta">
          <PriorityPicker
            priority={card.priority}
            onChange={(priority) => setCardPriority(card.path, priority)}
          />
          <div className="markdown-viewer__labels">
            {card.labels.map((label) => (
              <span
                className={`card__label card__label--${
                  board?.labels.find((l) => l.name === label)?.color ??
                    "neutral"
                }`}
                key={label}
              >
                {label}
              </span>
            ))}
            <button
              type="button"
              className="markdown-viewer__labels-button"
              onClick={() => setIsLabelPickerOpen(true)}
            >
              Labels…
            </button>
          </div>
        </div>
      )}

      {card && (
        <div className="markdown-viewer__path">
          {
            /* The board-relative path, the same form the board file stores. The
            absolute path goes in the tooltip: it is what the user needs when
            leaving for Finder or another editor, but it is too long to sit in
            this row. */
          }
          <span
            className="markdown-viewer__path-text"
            title={card.absolutePath}
          >
            {card.path}
          </span>
        </div>
      )}

      {card && board && (
        <LabelPickerDialog
          key={card.path}
          card={card}
          labels={board.labels}
          open={isLabelPickerOpen}
          onClose={() => setIsLabelPickerOpen(false)}
          onAddCardLabel={addCardLabel}
          onRemoveCardLabel={removeCardLabel}
          onCreateLabel={createLabel}
          onRenameLabel={renameLabel}
          onSetLabelColor={setLabelColor}
          onRemoveLabel={removeLabel}
        />
      )}

      {saveError && <p role="alert">{saveError}</p>}
      {status === "loading" && (
        <p className="markdown-viewer__placeholder">Loading…</p>
      )}
      {status === "error" && error && <p role="alert">{error}</p>}
      {status === "loaded" && draft !== undefined && (
        <MarkdownEditor value={draft} onChange={updateDraft} />
      )}
    </div>
  );
}
