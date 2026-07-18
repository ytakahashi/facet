import { useEffect, useRef, useState } from "react";
import { directoryOf } from "../../domain/boardPath.ts";
import { suggestMarkdownFileName } from "../../domain/cardFile.ts";
import { useBoardStore, useMarkdownViewer } from "../context/appContext.ts";
import type { UiError } from "../errors/toUiError.ts";
import { toUiError } from "../errors/toUiError.ts";
import { BoardDirectoryPicker } from "./BoardDirectoryPicker.tsx";
import { MarkdownFileBrowser } from "./MarkdownFileBrowser.tsx";

type AddCardMode = "new" | "existing";

interface AddCardDialogProps {
  boardPath: string;
  columnId: string;
  open: boolean;
  onClose: () => void;
}

export function AddCardDialog({
  boardPath,
  columnId,
  open,
  onClose,
}: AddCardDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const addNewCard = useBoardStore((state) => state.addNewCard);
  const addExistingCard = useBoardStore((state) => state.addExistingCard);
  const selectCard = useMarkdownViewer((state) => state.selectCard);
  const boardDirectory = directoryOf(boardPath);
  const [title, setTitle] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileNameEdited, setFileNameEdited] = useState(false);
  const [directory, setDirectory] = useState(boardDirectory);
  const [mode, setMode] = useState<AddCardMode>("new");
  const [selectedPath, setSelectedPath] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<UiError>();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setTitle("");
      setFileName("");
      setFileNameEdited(false);
      setDirectory(boardDirectory);
      setMode("new");
      setSelectedPath(undefined);
      setError(undefined);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [boardDirectory, open]);

  function handleTitleChange(nextTitle: string) {
    setTitle(nextTitle);
    if (error?.field === "title") setError(undefined);
    if (!fileNameEdited) {
      setFileName(nextTitle.trim() ? suggestMarkdownFileName(nextTitle) : "");
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const existingPath = selectedPath;
    if (mode === "existing" && !existingPath) return;
    setIsSubmitting(true);
    setError(undefined);
    try {
      const card = mode === "new"
        ? await addNewCard({ columnId, directory, fileName, title })
        : await addExistingCard({
          columnId,
          absolutePath: existingPath!,
        });
      setIsSubmitting(false);
      onClose();
      void selectCard(card);
    } catch (submitError) {
      setError(toUiError(submitError));
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
        <h2>Add card</h2>
        <div className="add-card-dialog__modes" role="group" aria-label="Mode">
          <button
            type="button"
            className={mode === "new" ? "is-selected" : undefined}
            aria-pressed={mode === "new"}
            onClick={() => {
              setMode("new");
              setError(undefined);
            }}
            disabled={isSubmitting}
          >
            New Markdown
          </button>
          <button
            type="button"
            className={mode === "existing" ? "is-selected" : undefined}
            aria-pressed={mode === "existing"}
            onClick={() => {
              setMode("existing");
              setError(undefined);
            }}
            disabled={isSubmitting}
          >
            Existing Markdown
          </button>
        </div>
        {error && (!error.field || mode === "existing") && (
          <p className="add-card-dialog__error" role="alert">{error.message}</p>
        )}
        {mode === "new"
          ? (
            <>
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
                {error?.field === "title" && (
                  <span className="add-card-dialog__error" role="alert">
                    {error.message}
                  </span>
                )}
              </label>
              <label>
                <span>File name</span>
                <input
                  type="text"
                  value={fileName}
                  onChange={(event) => {
                    setFileNameEdited(true);
                    setFileName(event.target.value);
                    if (error?.field === "fileName") setError(undefined);
                  }}
                  disabled={isSubmitting}
                  required
                />
                {error?.field === "fileName" && (
                  <span className="add-card-dialog__error" role="alert">
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
                  <p className="add-card-dialog__error" role="alert">
                    {error.message}
                  </p>
                )}
              </fieldset>
            </>
          )
          : (
            <fieldset disabled={isSubmitting}>
              <legend>Markdown file</legend>
              <MarkdownFileBrowser
                root={boardDirectory}
                selectedPath={selectedPath}
                onSelect={(path) => {
                  setSelectedPath(path);
                  setError(undefined);
                }}
                disabled={isSubmitting}
              />
            </fieldset>
          )}
        <div className="add-card-dialog__actions">
          <button type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || (mode === "existing" && !selectedPath)}
          >
            {isSubmitting ? "Adding…" : "Add card"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
