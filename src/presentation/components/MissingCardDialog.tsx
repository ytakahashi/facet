import { useEffect, useRef, useState } from "react";
import { directoryOf, resolveCardPath } from "../../domain/boardPath.ts";
import type { Card } from "../../domain/card.ts";
import { UseCaseError } from "../../usecase/useCaseError.ts";
import { useBoardStore, useMarkdownViewer } from "../context/appContext.ts";
import type { UiError } from "../errors/toUiError.ts";
import { toUiError } from "../errors/toUiError.ts";
import { MarkdownFileBrowser } from "./MarkdownFileBrowser.tsx";

type RepairMode = "browse" | "path";

interface MissingCardDialogProps {
  card: Card;
  boardPath: string;
  open: boolean;
  onClose: () => void;
  onRemoveFromBoard: (card: Card) => void;
}

// Where a card whose file could not be read gets pointed at one that can be.
// Both modes end in the same place - one absolute path inside the board
// directory - so the validation and the file read happen once, in the use case,
// rather than once per mode.
export function MissingCardDialog({
  card,
  boardPath,
  open,
  onClose,
  onRemoveFromBoard,
}: MissingCardDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const relocateCard = useBoardStore((state) => state.relocateCard);
  const discardCard = useMarkdownViewer((state) => state.discardCard);
  const selectCard = useMarkdownViewer((state) => state.selectCard);
  // The viewer normally holds no broken card (a broken tile opens this dialog
  // instead of the viewer), so this only matters for a card that was opened
  // while it was still readable.
  const isOpenInViewer = useMarkdownViewer((state) =>
    state.selectedPath === card.path
  );
  const boardDirectory = directoryOf(boardPath);
  const [mode, setMode] = useState<RepairMode>("browse");
  const [selectedPath, setSelectedPath] = useState<string>();
  const [pathInput, setPathInput] = useState(card.path);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<UiError>();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setMode("browse");
      setSelectedPath(undefined);
      setPathInput(card.path);
      setError(undefined);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [card.path, open]);

  async function repair(absolutePath: string) {
    const previousPath = card.path;
    setIsSubmitting(true);
    setError(undefined);
    try {
      const repaired = await relocateCard(previousPath, absolutePath);
      setIsSubmitting(false);
      onClose();
      // Only the card the viewer is actually showing: a repair is not a reason
      // to interrupt an edit in progress on some other card.
      if (isOpenInViewer) {
        discardCard(previousPath);
        void selectCard(repaired);
      }
    } catch (submitError) {
      setError(toUiError(submitError));
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (mode === "browse") {
      if (!selectedPath) return;
      await repair(selectedPath);
      return;
    }

    const input = pathInput.trim();
    if (!input) return;
    const resolved = resolveCardPath(boardDirectory, input);
    if (!resolved.ok) {
      // Reuses the use case's wording: a typed path lands on the same rule as
      // a picked one, and the message should not say otherwise.
      setError(toUiError(new UseCaseError("card.outside-board-directory")));
      return;
    }
    await repair(resolved.absolutePath);
  }

  const canSubmit = mode === "browse"
    ? Boolean(selectedPath)
    : Boolean(pathInput.trim());
  // Only a card whose path resolved has somewhere to look again; an
  // unresolvable one has no target to re-read.
  const recheckPath = card.fileState === "missing"
    ? card.absolutePath
    : undefined;

  return (
    <dialog
      ref={dialogRef}
      className="missing-card-dialog"
      onCancel={(event) => {
        event.preventDefault();
        if (!isSubmitting) onClose();
      }}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit}>
        <h2>Missing file</h2>
        <div className="missing-card-dialog__target">
          <p className="missing-card-dialog__title">{card.displayTitle}</p>
          <p className="missing-card-dialog__path">{card.path}</p>
          <p className="missing-card-dialog__reason">
            {card.fileState === "unresolvable"
              ? "This card's path must point inside the board directory."
              : "No file at this path."}
          </p>
        </div>
        {/* One input at a time, so an error never needs placing next to one. */}
        {error && (
          <p className="missing-card-dialog__error" role="alert">
            {error.message}
          </p>
        )}
        <div
          className="missing-card-dialog__modes"
          role="group"
          aria-label="Mode"
        >
          <button
            type="button"
            className={mode === "browse" ? "is-selected" : undefined}
            aria-pressed={mode === "browse"}
            onClick={() => {
              setMode("browse");
              setError(undefined);
            }}
            disabled={isSubmitting}
          >
            Browse
          </button>
          <button
            type="button"
            className={mode === "path" ? "is-selected" : undefined}
            aria-pressed={mode === "path"}
            onClick={() => {
              setMode("path");
              setError(undefined);
            }}
            disabled={isSubmitting}
          >
            Enter path
          </button>
        </div>
        {mode === "browse"
          ? (
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
          )
          : (
            <label>
              <span>Path relative to the board directory</span>
              <input
                type="text"
                value={pathInput}
                onChange={(event) => {
                  setPathInput(event.target.value);
                  setError(undefined);
                }}
                disabled={isSubmitting}
                autoFocus
                required
              />
            </label>
          )}
        {
          /* The manual refresh this app has instead of watching the file
            system: the card is only re-read when asked. */
        }
        {recheckPath && (
          <button
            type="button"
            className="missing-card-dialog__recheck"
            onClick={() => void repair(recheckPath)}
            disabled={isSubmitting}
          >
            Check again
          </button>
        )}
        <div className="missing-card-dialog__actions">
          {
            /* Hands the card to the one delete flow rather than removing it
              here, so the confirmation and its wording stay in one place. */
          }
          <button
            type="button"
            className="missing-card-dialog__remove"
            onClick={() => onRemoveFromBoard(card)}
            disabled={isSubmitting}
          >
            Remove from board…
          </button>
          <button type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting || !canSubmit}>
            {isSubmitting
              ? "Updating…"
              : mode === "browse"
              ? "Use this file"
              : "Update path"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
