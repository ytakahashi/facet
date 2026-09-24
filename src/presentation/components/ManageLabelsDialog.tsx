import { useEffect, useMemo, useRef, useState } from "react";
import { autoScrollForElements } from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import type { Edge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import {
  attachClosestEdge,
  extractClosestEdge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { type Board, countCardsByLabel } from "../../domain/board.ts";
import type { LabelColor, LabelDefinition } from "../../domain/label.ts";
import { toUiError } from "../errors/toUiError.ts";
import type { LabelDragData } from "./dragData.ts";
import { LabelColorSwatchGrid } from "./LabelColorSwatchGrid.tsx";
import { LabelCreateForm } from "./LabelCreateForm.tsx";
import { resolveLabelMove } from "./resolveLabelMove.ts";

interface Props {
  board: Board;
  open: boolean;
  onClose: () => void;
  onCreateLabel: (name: string, color: LabelColor) => void;
  onRenameLabel: (name: string, nextName: string) => void;
  onSetLabelColor: (name: string, color: LabelColor) => void;
  onRemoveLabel: (name: string) => void;
  onMoveLabel: (name: string, toIndex: number) => void;
}

type RowMode = "edit" | "confirm-delete";

const NO_COUNTS: ReadonlyMap<string, number> = new Map();

export function ManageLabelsDialog(props: Props) {
  const { board, open, onClose, onMoveLabel } = props;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // Held here rather than per row so that only one row is ever being edited
  // or confirming a deletion.
  const [active, setActive] = useState<{ name: string; mode: RowMode }>();
  // Both the sidebar and the viewer keep this dialog mounted, so counting
  // only while open avoids re-scanning every card on each board change.
  const counts = useMemo(
    () => open ? countCardsByLabel(board) : NO_COUNTS,
    [open, board],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setActive(undefined);
      dialog.showModal();
      // showModal() focuses the first control, which here is the top row's
      // Edit button and reads as that row being selected. Nothing in this
      // dialog is a natural starting point, so the dialog itself takes focus
      // (hence tabIndex={-1}); Escape still reaches its cancel handler.
      dialog.focus();
    } else if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    return monitorForElements({
      onDrop({ source, location }) {
        const move = resolveLabelMove(source, location.current.dropTargets);
        if (move) onMoveLabel(move.name, move.toIndex);
      },
    });
  }, [open, onMoveLabel]);

  // The list is the dialog's scrolling region (its height is capped in
  // App.css), so dragging near its edge scrolls it and a label can be carried
  // to a position that is off-screen when the drag starts.
  useEffect(() => {
    const list = listRef.current;
    if (!open || !list) return;
    return autoScrollForElements({
      element: list,
      canScroll: ({ source }) => source.data.type === "label",
    });
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="manage-labels-dialog"
      tabIndex={-1}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
    >
      <h2>Manage labels</h2>
      <ul ref={listRef} className="manage-labels-dialog__list">
        {board.labels.map((label, index) => (
          <ManageLabelRow
            key={label.name}
            label={label}
            index={index}
            count={counts.get(label.name) ?? 0}
            mode={active?.name === label.name ? active.mode : undefined}
            onModeChange={(mode) =>
              setActive(mode && { name: label.name, mode })}
            onRename={props.onRenameLabel}
            onColor={props.onSetLabelColor}
            onRemove={props.onRemoveLabel}
          />
        ))}
      </ul>
      <LabelCreateForm open={open} onCreateLabel={props.onCreateLabel} />
      <div className="manage-labels-dialog__actions">
        <button type="button" onClick={onClose}>Close</button>
      </div>
    </dialog>
  );
}

function ManageLabelRow({
  label,
  index,
  count,
  mode,
  onModeChange,
  onRename,
  onColor,
  onRemove,
}: {
  label: LabelDefinition;
  index: number;
  count: number;
  mode: RowMode | undefined;
  onModeChange: (mode: RowMode | undefined) => void;
  onRename: (name: string, nextName: string) => void;
  onColor: (name: string, color: LabelColor) => void;
  onRemove: (name: string) => void;
}) {
  const rowRef = useRef<HTMLLIElement>(null);
  const handleRef = useRef<HTMLSpanElement>(null);
  const [draft, setDraft] = useState(label.name);
  const [error, setError] = useState<string>();
  const [edge, setEdge] = useState<Edge | null>(null);
  // Set when the name input is left on purpose (Escape, Delete) so that its
  // blur does not commit the draft on the way out.
  const skipBlurRename = useRef(false);

  useEffect(() => {
    const element = rowRef.current;
    const dragHandle = handleRef.current;
    if (!element || !dragHandle) return;
    const data: LabelDragData = { type: "label", name: label.name, index };
    return combine(
      draggable({ element, dragHandle, getInitialData: () => data }),
      dropTargetForElements({
        element,
        canDrop: ({ source }) =>
          source.data.type === "label" && source.data.name !== label.name,
        getData: ({ input }) =>
          attachClosestEdge(data, {
            element,
            input,
            allowedEdges: ["top", "bottom"],
          }),
        getIsSticky: () => true,
        onDragEnter: ({ self }) => setEdge(extractClosestEdge(self.data)),
        onDrag: ({ self }) => setEdge(extractClosestEdge(self.data)),
        onDragLeave: () => setEdge(null),
        onDrop: () => setEdge(null),
      }),
    );
  }, [label.name, index]);

  // A blank or unchanged name reverts silently, same as ColumnHeader; a
  // duplicate is the one case worth surfacing.
  function commitRename() {
    const name = draft.trim();
    if (!name || name === label.name) {
      onModeChange(undefined);
      return;
    }
    try {
      onRename(label.name, name);
      onModeChange(undefined);
    } catch (cause) {
      setError(toUiError(cause).message);
    }
  }

  return (
    <li
      ref={rowRef}
      className={`manage-labels-dialog__item${
        edge === "top"
          ? " manage-labels-dialog__item--drop-before"
          : edge === "bottom"
          ? " manage-labels-dialog__item--drop-after"
          : ""
      }`}
    >
      {
        /* Deliberately not a button, as in ColumnHeader: reordering is
          pointer-only, and WebKit neither focuses a button on click nor tabs
          to one by default, so a focusable handle would promise a keyboard
          interaction that users cannot reach. */
      }
      <span
        ref={handleRef}
        className="manage-labels-dialog__handle"
        title="Drag to reorder"
        aria-hidden="true"
      >
        ⋮⋮
      </span>
      <span className={`label-dot label-dot--${label.color}`} />
      {mode === "confirm-delete"
        ? (
          <div className="manage-labels-dialog__confirm">
            <span>
              Delete "{label.name}"?{count > 0 &&
                ` It is removed from ${count} ${
                  count === 1 ? "card" : "cards"
                }.`}
            </span>
            <button
              type="button"
              className="manage-labels-dialog__button"
              onClick={() => {
                onRemove(label.name);
                onModeChange(undefined);
              }}
            >
              Delete
            </button>
            <button
              type="button"
              className="manage-labels-dialog__button"
              onClick={() => {
                skipBlurRename.current = false;
                onModeChange("edit");
              }}
            >
              Cancel
            </button>
          </div>
        )
        : mode === "edit"
        ? (
          <div className="manage-labels-dialog__edit">
            <input
              type="text"
              className="manage-labels-dialog__name-input"
              value={draft}
              aria-label="Label name"
              autoFocus
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={() => {
                if (!skipBlurRename.current) commitRename();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") commitRename();
                if (event.key === "Escape") {
                  // Cancels the rename only; the dialog stays open.
                  event.preventDefault();
                  event.stopPropagation();
                  skipBlurRename.current = true;
                  onModeChange(undefined);
                }
              }}
            />
            {
              /* WebKit does not focus a button on click, so without
                suppressing mousedown the name input's blur would commit and
                leave edit mode before the swatch/Delete click is dispatched
                (same WebKit quirk noted for AddColumn). */
            }
            <div
              className="manage-labels-dialog__edit-actions"
              onMouseDown={(event) => event.preventDefault()}
            >
              <LabelColorSwatchGrid
                value={label.color}
                onChange={(color) => onColor(label.name, color)}
              />
              <button
                type="button"
                className="manage-labels-dialog__button"
                onClick={() => {
                  skipBlurRename.current = true;
                  onModeChange("confirm-delete");
                }}
              >
                Delete
              </button>
            </div>
            {error && (
              <p className="manage-labels-dialog__error" role="alert">
                {error}
              </p>
            )}
          </div>
        )
        : (
          <>
            <span className="manage-labels-dialog__name">{label.name}</span>
            <span className="manage-labels-dialog__count">
              {count} {count === 1 ? "card" : "cards"}
            </span>
            <button
              type="button"
              className="manage-labels-dialog__button"
              onClick={() => {
                setDraft(label.name);
                setError(undefined);
                skipBlurRename.current = false;
                onModeChange("edit");
              }}
            >
              Edit
            </button>
          </>
        )}
    </li>
  );
}
