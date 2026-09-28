import { useEffect, useRef } from "react";
import type { Card } from "../../domain/card.ts";
import type { LabelColor, LabelDefinition } from "../../domain/label.ts";
import { LabelCreateForm } from "./LabelCreateForm.tsx";

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

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

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
        {labels.map((label) => (
          <li key={label.name} className="label-picker-dialog__item">
            <label className="label-picker-dialog__checkbox">
              <input
                type="checkbox"
                checked={card.labels.includes(label.name)}
                aria-label={label.name}
                onChange={(event) =>
                  event.target.checked
                    ? onAddCardLabel(card.path, label.name)
                    : onRemoveCardLabel(card.path, label.name)}
              />
              <span
                className={`label-dot label-dot--${label.color}`}
              />
              <span className="label-picker-dialog__name">{label.name}</span>
            </label>
          </li>
        ))}
      </ul>
      <LabelCreateForm open={open} onCreateLabel={onCreateLabel} />
      <div className="label-picker-dialog__actions">
        <button type="button" onClick={onManageLabels}>Manage labels…</button>
        <button type="button" onClick={onClose}>Close</button>
      </div>
    </dialog>
  );
}
