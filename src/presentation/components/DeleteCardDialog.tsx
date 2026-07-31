import { useEffect, useRef, useState } from "react";
import type { Card } from "../../domain/card.ts";
import { useBoardStore, useMarkdownViewer } from "../context/appContext.ts";
import type { UiError } from "../errors/toUiError.ts";
import { toUiError } from "../errors/toUiError.ts";
import { isCardSaving, isMarkdownDirty } from "../store/markdownViewerStore.ts";

interface DeleteCardDialogProps {
  card: Card;
  open: boolean;
  onClose: () => void;
}

// The single confirmation for removing a card. Deleting the Markdown file is
// opt-in and off by default: dropping the board's reference is reversible by
// re-adding the same file, while deleting it is not - and the same Markdown
// may well be referenced by another board this one cannot see.
export function DeleteCardDialog(
  { card, open, onClose }: DeleteCardDialogProps,
) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const removeCard = useBoardStore((state) => state.removeCard);
  const discardCard = useMarkdownViewer((state) => state.discardCard);
  const hasUnsavedChanges = useMarkdownViewer((state) =>
    state.selectedPath === card.path && isMarkdownDirty(state)
  );
  // A save started before this dialog opened can still be in flight (the modal
  // blocks the Save button, not a write already on its way). Deleting now
  // would let that write recreate the file, so the confirm button waits it out.
  const isSaving = useMarkdownViewer((state) => isCardSaving(state, card.path));
  // Offered only for a card whose file was there when the board loaded.
  // A card the board could not read has nothing to promise the user will be
  // deleted, and offering it anyway would read as "there is a file to lose".
  const canDeleteFile = card.fileState === "available";
  const [deleteFile, setDeleteFile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<UiError>();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      // Always reopen unchecked. Carrying the previous choice over would let
      // someone who ticked the box for one card delete the next card's file
      // without meaning to.
      setDeleteFile(false);
      setError(undefined);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(undefined);
    try {
      await removeCard(card.path, { deleteFile });
      setIsSubmitting(false);
      onClose();
      // Only after the removal succeeded: a failed delete must leave the
      // editor open with its draft intact.
      discardCard(card.path);
    } catch (submitError) {
      setError(toUiError(submitError));
      setIsSubmitting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="delete-card-dialog"
      onCancel={(event) => {
        event.preventDefault();
        if (!isSubmitting) onClose();
      }}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit}>
        <h2>Delete card</h2>
        {error && (
          <p className="delete-card-dialog__error" role="alert">
            {error.message}
          </p>
        )}
        <div className="delete-card-dialog__target">
          <p className="delete-card-dialog__title">{card.displayTitle}</p>
          <p className="delete-card-dialog__path">{card.path}</p>
        </div>
        <label className="delete-card-dialog__file-option">
          <input
            type="checkbox"
            checked={deleteFile}
            onChange={(event) => setDeleteFile(event.target.checked)}
            disabled={isSubmitting || !canDeleteFile}
          />
          <span>Also delete the Markdown file</span>
        </label>
        {card.fileState === "unresolvable" && (
          <p className="delete-card-dialog__note">
            This card's path could not be resolved inside the board directory,
            so only the board reference can be removed.
          </p>
        )}
        {card.fileState === "missing" && (
          <p className="delete-card-dialog__note">
            There is no file at this path, so only the board reference can be
            removed.
          </p>
        )}
        {card.fileState === "unreadable" && (
          <p className="delete-card-dialog__note">
            The file at this path could not be read, so only the board reference
            can be removed.
          </p>
        )}
        {deleteFile && canDeleteFile && (
          <p className="delete-card-dialog__warning" role="alert">
            <span className="delete-card-dialog__path">
              {card.absolutePath}
            </span>
            <span>will be deleted. This cannot be undone.</span>
          </p>
        )}
        {hasUnsavedChanges && (
          <p className="delete-card-dialog__note">
            Unsaved changes to this card will be discarded.
          </p>
        )}
        {isSaving && (
          <p className="delete-card-dialog__note" role="status">
            Waiting for this card's Markdown to finish saving…
          </p>
        )}
        <div className="delete-card-dialog__actions">
          <button type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          {
            /* The label follows the checkbox so the button never reads as a
              plain "Delete" while it is about to remove a file too. */
          }
          <button
            type="submit"
            className={deleteFile
              ? "delete-card-dialog__confirm delete-card-dialog__confirm--destructive"
              : "delete-card-dialog__confirm"}
            disabled={isSubmitting || isSaving}
          >
            {isSubmitting
              ? "Deleting…"
              : deleteFile
              ? "Delete card and file"
              : "Remove from board"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
