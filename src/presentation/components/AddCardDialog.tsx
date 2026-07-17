import { useEffect, useRef, useState } from "react";
import { directoryOf } from "../../domain/boardPath.ts";
import { suggestMarkdownFileName } from "../../domain/cardFile.ts";
import { useBoardStore, useMarkdownViewer } from "../context/appContext.ts";
import { BoardDirectoryPicker } from "./BoardDirectoryPicker.tsx";

interface AddCardDialogProps {
  boardPath: string;
  columnId: string;
  open: boolean;
  onClose: () => void;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function AddCardDialog({
  boardPath,
  columnId,
  open,
  onClose,
}: AddCardDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const addNewCard = useBoardStore((state) => state.addNewCard);
  const selectCard = useMarkdownViewer((state) => state.selectCard);
  const boardDirectory = directoryOf(boardPath);
  const [title, setTitle] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileNameEdited, setFileNameEdited] = useState(false);
  const [directory, setDirectory] = useState(boardDirectory);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setTitle("");
      setFileName("");
      setFileNameEdited(false);
      setDirectory(boardDirectory);
      setError(undefined);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [boardDirectory, open]);

  function handleTitleChange(nextTitle: string) {
    setTitle(nextTitle);
    if (!fileNameEdited) {
      setFileName(nextTitle.trim() ? suggestMarkdownFileName(nextTitle) : "");
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(undefined);
    try {
      const card = await addNewCard({ columnId, directory, fileName, title });
      setIsSubmitting(false);
      onClose();
      void selectCard(card);
    } catch (submitError) {
      setError(toMessage(submitError));
      setIsSubmitting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="add-card-dialog"
      onCancel={(event) => {
        event.preventDefault();
        if (!isSubmitting) onClose();
      }}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit}>
        <h2>Add new Markdown</h2>
        {error && <p className="add-card-dialog__error" role="alert">{error}
        </p>}
        <label>
          <span>Title</span>
          <input
            type="text"
            value={title}
            onChange={(event) => handleTitleChange(event.target.value)}
            disabled={isSubmitting}
            autoFocus
            required
          />
        </label>
        <label>
          <span>File name</span>
          <input
            type="text"
            value={fileName}
            onChange={(event) => {
              setFileNameEdited(true);
              setFileName(event.target.value);
            }}
            disabled={isSubmitting}
            required
          />
        </label>
        <fieldset disabled={isSubmitting}>
          <legend>Directory</legend>
          <BoardDirectoryPicker
            root={boardDirectory}
            value={directory}
            onChange={setDirectory}
          />
        </fieldset>
        <div className="add-card-dialog__actions">
          <button type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating…" : "Create card"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
