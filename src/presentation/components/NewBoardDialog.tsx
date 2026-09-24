import { useEffect, useRef, useState } from "react";
import { DEFAULT_BOARD_FILE_NAME } from "../../domain/boardFile.ts";
import {
  useDirectoryBrowsing,
  useNewBoardDialog,
  useWorkspace,
} from "../context/appContext.ts";
import type { UiError } from "../errors/toUiError.ts";
import { toUiError } from "../errors/toUiError.ts";
import { BoardDirectoryPicker } from "./BoardDirectoryPicker.tsx";

export function NewBoardDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const isOpen = useNewBoardDialog((state) => state.isOpen);
  const close = useNewBoardDialog((state) => state.close);
  const createBoard = useWorkspace((state) => state.createBoard);
  const { homeDirectory } = useDirectoryBrowsing();
  const [name, setName] = useState("");
  const [fileName, setFileName] = useState(DEFAULT_BOARD_FILE_NAME);
  // undefined until the async home-directory lookup resolves; the picker
  // and submit stay unavailable in the meantime.
  const [directory, setDirectory] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<UiError>();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      // Every open starts from the defaults instead of carrying the previous
      // input over (same reset policy as AddCardDialog).
      setName("");
      setFileName(DEFAULT_BOARD_FILE_NAME);
      setDirectory(undefined);
      setError(undefined);
      dialog.showModal();
      // Guards against a lookup started by a previous open resolving late
      // and overwriting this open's directory or error state.
      let cancelled = false;
      homeDirectory()
        .then((home) => {
          if (!cancelled) setDirectory(home);
        })
        .catch((homeError) => {
          if (!cancelled) setError(toUiError(homeError));
        });
      return () => {
        cancelled = true;
      };
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [homeDirectory, isOpen]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!directory) return;
    setIsSubmitting(true);
    setError(undefined);
    try {
      await createBoard({ directory, fileName, name });
      setIsSubmitting(false);
      close();
    } catch (submitError) {
      setError(toUiError(submitError));
      setIsSubmitting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="new-board-dialog"
      onCancel={(event) => {
        event.preventDefault();
        if (!isSubmitting) close();
      }}
      onClose={close}
    >
      <form onSubmit={handleSubmit}>
        <h2>New board</h2>
        {error && !error.field && (
          <p className="new-board-dialog__error" role="alert">
            {error.message}
          </p>
        )}
        <label>
          <span>Board name</span>
          <input
            type="text"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (error?.field === "boardName") setError(undefined);
            }}
            disabled={isSubmitting}
            autoFocus
            required
          />
          {error?.field === "boardName" && (
            <span className="new-board-dialog__error" role="alert">
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
              setFileName(event.target.value);
              if (error?.field === "fileName") setError(undefined);
            }}
            disabled={isSubmitting}
            required
          />
          {error?.field === "fileName" && (
            <span className="new-board-dialog__error" role="alert">
              {error.message}
            </span>
          )}
        </label>
        <fieldset disabled={isSubmitting}>
          <legend>Directory</legend>
          {directory
            ? (
              <BoardDirectoryPicker
                root="/"
                value={directory}
                onChange={setDirectory}
              />
            )
            : <p>Loading…</p>}
        </fieldset>
        <div className="new-board-dialog__actions">
          <button type="button" onClick={close} disabled={isSubmitting}>
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting || !directory}>
            {isSubmitting ? "Creating…" : "Create board"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
