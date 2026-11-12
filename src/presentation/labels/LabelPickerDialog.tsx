import { useEffect, useId, useRef, useState } from "react";
import type { Card } from "../../domain/card.ts";
import type { LabelColor, LabelDefinition } from "../../domain/label.ts";
import { LabelCreateForm } from "./LabelCreateForm.tsx";
import { filterLabels } from "./filterLabels.ts";

interface LabelPickerDialogProps {
  card: Card;
  labels: LabelDefinition[];
  open: boolean;
  onClose: () => void;
  onAddCardLabel: (path: string, labelName: string) => void;
  onRemoveCardLabel: (path: string, labelName: string) => void;
  onCreateLabel: (name: string, color: LabelColor) => void;
  onManageLabels: () => void;
}

// Card membership and quick creation stay here; board-wide registry editing
// lives in ManageLabelsDialog and returns to this picker when closed.
export function LabelPickerDialog({
  card,
  labels,
  open,
  onClose,
  onAddCardLabel,
  onRemoveCardLabel,
  onCreateLabel,
  onManageLabels,
}: LabelPickerDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const [query, setQuery] = useState("");
  const visibleLabels = filterLabels(labels, query);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      // Reset only on reopening; Manage Labels stacks above this open picker
      // and must preserve the query when it returns.
      setQuery("");
      dialog.showModal();
      filterRef.current?.focus();
    } else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="label-picker-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
    >
      <div className="label-picker-dialog__header">
        <h2 id={titleId}>Labels</h2>
        <input
          ref={filterRef}
          className="label-picker-dialog__filter"
          type="text"
          aria-label="Filter labels"
          placeholder="Filter labels…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <ul className="label-picker-dialog__list">
        {visibleLabels.map((label) => (
          <li key={label.name} className="label-picker-dialog__item">
            <label className="label-picker-dialog__checkbox">
              <input
                type="checkbox"
                checked={card.labels.includes(label.name)}
                aria-label={label.name}
                onChange={(event) =>
                  event.target.checked
                    ? onAddCardLabel(card.path, label.name)
                    : onRemoveCardLabel(card.path, label.name)
                }
              />
              <span className={`label-dot label-dot--${label.color}`} />
              <span className="label-picker-dialog__name">{label.name}</span>
            </label>
          </li>
        ))}
      </ul>
      {visibleLabels.length === 0 && (
        <p className="label-picker-dialog__empty" role="status">
          {labels.length === 0 ? "No labels yet" : "No labels match"}
        </p>
      )}
      {open && <LabelCreateForm onCreateLabel={onCreateLabel} />}
      <div className="label-picker-dialog__actions">
        <button type="button" onClick={onManageLabels}>
          Manage labels…
        </button>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </dialog>
  );
}
