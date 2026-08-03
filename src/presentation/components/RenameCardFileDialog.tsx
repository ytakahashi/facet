import { useEffect, useRef, useState } from "react";
import { directoryOf, fileNameOf } from "../../domain/boardPath.ts";
import type { Card } from "../../domain/card.ts";
import { useBoardStore, useMarkdownViewer } from "../context/appContext.ts";
import type { UiError } from "../errors/toUiError.ts";
import { toUiError } from "../errors/toUiError.ts";
import { isCardSaving } from "../store/markdownViewerStore.ts";
import { BoardDirectoryPicker } from "./BoardDirectoryPicker.tsx";

interface RenameCardFileDialogProps {
  card: Card;
  boardPath: string;
  open: boolean;
  onClose: () => void;
}

// Renaming a file and moving it are one dialog because they are one operation:
// both name a new path inside the board directory, and doing them separately
// would move the file twice to get to one place.
export function RenameCardFileDialog(
  { card, boardPath, open, onClose }: RenameCardFileDialogProps,
) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const renameCardFile = useBoardStore((state) => state.renameCardFile);
  const retargetCard = useMarkdownViewer((state) => state.retargetCard);
  // A save started before this dialog opened can still be in flight (the modal
  // blocks the Save button, not a write already on its way). That write holds
  // the path it started with, so moving the file now would land it back at the
  // path the file just left.
  const isSaving = useMarkdownViewer((state) => isCardSaving(state, card.path));
  const boardDirectory = directoryOf(boardPath);
  const initialDirectory = card.absolutePath
    ? directoryOf(card.absolutePath)
    : boardDirectory;
  const [fileName, setFileName] = useState(fileNameOf(card.path));
  const [directory, setDirectory] = useState(initialDirectory);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<UiError>();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setFileName(fileNameOf(card.path));
      setDirectory(initialDirectory);
      setError(undefined);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [card.path, initialDirectory, open]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const previousPath = card.path;
    setIsSubmitting(true);
    setError(undefined);
    try {
      const moved = await renameCardFile(previousPath, directory, fileName);
      setIsSubmitting(false);
      // The viewer keeps showing the same file, so it is repointed rather than
      // reopened: reopening would drop an edit in progress, and leaving it
      // alone would let the next save write back to where the file used to be.
      // Repointed before the dialog closes so the viewer is never asked to
      // render a selected path the board no longer has.
      retargetCard(previousPath, moved);
      onClose();
    } catch (submitError) {
      setError(toUiError(submitError));
      setIsSubmitting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="rename-card-file-dialog"
      onCancel={(event) => {
        event.preventDefault();
        if (!isSubmitting) onClose();
      }}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit}>
        <h2>Rename or move file</h2>
        {error && !error.field && (
          <p className="rename-card-file-dialog__error" role="alert">
            {error.message}
          </p>
        )}
        <p className="rename-card-file-dialog__path">{card.path}</p>
        <label>
          <span>File name</span>
          <input
            type="text"
            value={fileName}
            onChange={(event) => {
              setFileName(event.target.value);
              if (error?.field === "fileName") setError(undefined);
            }}
            disabled={isSubmitting}
            autoFocus
            required
          />
          {error?.field === "fileName" && (
            <span className="rename-card-file-dialog__error" role="alert">
              {error.message}
            </span>
          )}
        </label>
        <fieldset disabled={isSubmitting}>
          <legend>Directory</legend>
          <BoardDirectoryPicker
            root={boardDirectory}
            value={directory}
            onChange={(path) => {
              setDirectory(path);
              if (error?.field === "directory") setError(undefined);
            }}
          />
          {error?.field === "directory" && (
            <p className="rename-card-file-dialog__error" role="alert">
              {error.message}
            </p>
          )}
        </fieldset>
        {
          /* The app only knows the board it has open, so a board that refers
            to this file from elsewhere keeps pointing at the old path. Said
            plainly here rather than fixed silently: rewriting board files the
            user has not opened would be the more surprising behaviour, and the
            card that breaks can be repaired from its own board. */
        }
        <p className="rename-card-file-dialog__note">
          Other boards referencing this file will show it as missing until
          repaired.
        </p>
        {isSaving && (
          <p className="rename-card-file-dialog__note" role="status">
            Waiting for this card's Markdown to finish saving…
          </p>
        )}
        <div className="rename-card-file-dialog__actions">
          <button type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={!fileName.trim() || isSubmitting || isSaving}
          >
            {isSubmitting ? "Moving…" : "Move file"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
