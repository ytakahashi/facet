import { useEffect, useRef, useState } from "react";
import type { Card } from "../../domain/card.ts";
import type { LabelColor, LabelDefinition } from "../../domain/label.ts";
import type { UiError } from "../errors/toUiError.ts";
import { toUiError } from "../errors/toUiError.ts";
import { LabelColorSwatchGrid } from "./LabelColorSwatchGrid.tsx";

const DEFAULT_COLOR: LabelColor = "ruby";

interface LabelPickerDialogProps {
  card: Card;
  labels: LabelDefinition[];
  open: boolean;
  onClose: () => void;
  onAddCardLabel: (path: string, labelName: string) => void;
  onRemoveCardLabel: (path: string, labelName: string) => void;
  onCreateLabel: (name: string, color: LabelColor) => void;
  onRenameLabel: (name: string, nextName: string) => void;
  onSetLabelColor: (name: string, color: LabelColor) => void;
  onRemoveLabel: (name: string) => void;
}

// Toggling which labels are on this card and managing the
// board-wide label registry (create/rename/recolor/delete)
// live in a single dialog rather than two separate screens.
export function LabelPickerDialog({
  card,
  labels,
  open,
  onClose,
  onAddCardLabel,
  onRemoveCardLabel,
  onCreateLabel,
  onRenameLabel,
  onSetLabelColor,
  onRemoveLabel,
}: LabelPickerDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [editingName, setEditingName] = useState<string>();
  const [editDraft, setEditDraft] = useState("");
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<LabelColor>(DEFAULT_COLOR);
  const [error, setError] = useState<
    (UiError & { target: "create" | "rename" }) | undefined
  >();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setEditingName(undefined);
      setNewName("");
      setNewColor(DEFAULT_COLOR);
      setError(undefined);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function startEditing(label: LabelDefinition) {
    setEditingName(label.name);
    setEditDraft(label.name);
    setError(undefined);
  }

  // A blank or unchanged name reverts silently, same as ColumnHeader; a
  // genuine duplicate is the one case worth surfacing, since it is an
  // explicit rename rather than a no-op cancel.
  function commitRename(label: LabelDefinition) {
    const trimmed = editDraft.trim();
    if (trimmed === "" || trimmed === label.name) {
      setEditingName(undefined);
      return;
    }
    try {
      onRenameLabel(label.name, trimmed);
      setEditingName(undefined);
      setError(undefined);
    } catch (cause) {
      setError({ ...toUiError(cause), target: "rename" });
    }
  }

  function handleCreateSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = newName.trim();
    if (trimmed === "") return;
    try {
      onCreateLabel(trimmed, newColor);
      setNewName("");
      setNewColor(DEFAULT_COLOR);
      setError(undefined);
    } catch (cause) {
      setError({ ...toUiError(cause), target: "create" });
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="label-picker-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
    >
      <h2>Labels</h2>
      <ul className="label-picker-dialog__list">
        {labels.map((label) => {
          const isEditing = editingName === label.name;
          const isChecked = card.labels.includes(label.name);
          return (
            <li key={label.name} className="label-picker-dialog__item">
              <label className="label-picker-dialog__checkbox">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(event) =>
                    event.target.checked
                      ? onAddCardLabel(card.path, label.name)
                      : onRemoveCardLabel(card.path, label.name)}
                />
                <span
                  className={`label-picker-dialog__dot label-picker-dialog__dot--${label.color}`}
                />
              </label>
              {isEditing
                ? (
                  <>
                    <input
                      type="text"
                      className="label-picker-dialog__name-input"
                      value={editDraft}
                      aria-label="Label name"
                      onChange={(event) => setEditDraft(event.target.value)}
                      onBlur={() => commitRename(label)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") commitRename(label);
                        // Escape unmounts the input before its blur handler
                        // could run, so the draft is discarded.
                        if (event.key === "Escape") setEditingName(undefined);
                      }}
                      onFocus={(event) => event.currentTarget.select()}
                      autoFocus
                    />
                    {
                      /* WebKit does not focus a button on click, so without
                        suppressing mousedown here the name input's blur
                        would fire first and switch this row out of edit
                        mode before the swatch/delete click is dispatched
                        (same WebKit quirk noted for AddColumn). */
                    }
                    <div
                      className="label-picker-dialog__edit-actions"
                      onMouseDown={(event) => event.preventDefault()}
                    >
                      <LabelColorSwatchGrid
                        value={label.color}
                        onChange={(color) => onSetLabelColor(label.name, color)}
                      />
                      <button
                        type="button"
                        onClick={() => onRemoveLabel(label.name)}
                      >
                        Delete
                      </button>
                    </div>
                    {error?.target === "rename" &&
                      editingName === label.name && (
                      <p className="label-picker-dialog__error" role="alert">
                        {error.message}
                      </p>
                    )}
                  </>
                )
                : (
                  <>
                    <span className="label-picker-dialog__name">
                      {label.name}
                    </span>
                    <button
                      type="button"
                      className="label-picker-dialog__edit"
                      onClick={() => startEditing(label)}
                    >
                      Edit
                    </button>
                  </>
                )}
            </li>
          );
        })}
      </ul>
      <form
        className="label-picker-dialog__create"
        onSubmit={handleCreateSubmit}
      >
        <input
          type="text"
          value={newName}
          placeholder="New label"
          aria-label="New label name"
          onChange={(event) => {
            setNewName(event.target.value);
            if (error?.target === "create") setError(undefined);
          }}
        />
        <LabelColorSwatchGrid value={newColor} onChange={setNewColor} />
        {error?.target === "create" && (
          <p className="label-picker-dialog__error" role="alert">
            {error.message}
          </p>
        )}
        <button type="submit" disabled={newName.trim() === ""}>
          Add
        </button>
      </form>
      <div className="label-picker-dialog__actions">
        <button type="button" onClick={onClose}>Close</button>
      </div>
    </dialog>
  );
}
