import { useEffect, useMemo, useRef, useState } from "react";
import { autoScrollForElements } from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element";
import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import type { Board } from "../../domain/board.ts";
import type { Card as CardModel } from "../../domain/card.ts";
import { isCardFileBroken } from "../../domain/card.ts";
import type { LabelColor } from "../../domain/label.ts";
import {
  useBoardStore,
  useFilterStore,
  useMarkdownViewer,
} from "../context/appContext.ts";
import { resolveColumnMove } from "./resolveColumnMove.ts";
import { resolveMove } from "./resolveMove.ts";
import { Column } from "./Column.tsx";
import { AddCardDialog } from "./AddCardDialog.tsx";
import { AddColumn } from "./AddColumn.tsx";
import { BoardName } from "./BoardName.tsx";
import { CardSearchDialog } from "./CardSearchDialog.tsx";
import { DeleteCardDialog } from "./DeleteCardDialog.tsx";
import { MissingCardDialog } from "./MissingCardDialog.tsx";

export function KanbanBoard({ board }: { board: Board }) {
  const columnsRef = useRef<HTMLDivElement>(null);
  const moveCard = useBoardStore((state) => state.moveCard);
  const moveColumn = useBoardStore((state) => state.moveColumn);
  const renameBoard = useBoardStore((state) => state.renameBoard);
  const renameColumn = useBoardStore((state) => state.renameColumn);
  const removeColumn = useBoardStore((state) => state.removeColumn);
  const saveError = useBoardStore((state) => state.saveError);
  const saveConflict = useBoardStore((state) => state.saveConflict);
  const conflictResolutionError = useBoardStore(
    (state) => state.conflictResolutionError,
  );
  const retrySave = useBoardStore((state) => state.retrySave);
  const reloadBoard = useBoardStore((state) => state.reloadBoard);
  const overwriteBoard = useBoardStore((state) => state.overwriteBoard);
  const boardPath = useBoardStore((state) => state.path);
  const criteria = useFilterStore((state) => state.criteria);
  const selectCard = useMarkdownViewer((state) => state.selectCard);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  // Keep the last-targeted column around after closing so the dialog stays
  // mounted and its `open` prop can toggle through a real dialog.close() —
  // unmounting on every close bypasses the browser's native focus restore.
  const [addToColumnId, setAddToColumnId] = useState<string>();
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);
  // Kept after closing for the same reason as addToColumnId. Holding the card
  // itself rather than its path keeps the dialog renderable in the moment
  // between a successful delete and the close taking effect.
  const [deleteTarget, setDeleteTarget] = useState<CardModel>();
  const [isDeleteCardOpen, setIsDeleteCardOpen] = useState(false);
  // Kept after closing for the same reason as deleteTarget.
  const [repairTarget, setRepairTarget] = useState<CardModel>();
  const [isMissingCardOpen, setIsMissingCardOpen] = useState(false);
  // Built once per registry change and threaded down to Card, rather than
  // having every Card re-scan board.labels itself for each of its labels.
  const labelColors = useMemo(
    () =>
      new Map<string, LabelColor>(
        board.labels.map((label) => [label.name, label.color]),
      ),
    [board.labels],
  );

  useEffect(() => {
    // A board can change in-place through Open Recent. Never carry a dialog
    // target from the previous board into the newly loaded board.
    setIsAddCardOpen(false);
    setAddToColumnId(undefined);
    setIsDeleteCardOpen(false);
    setDeleteTarget(undefined);
    setIsMissingCardOpen(false);
    setRepairTarget(undefined);
    setIsSearchOpen(false);
  }, [boardPath]);

  // Cmd+P opens the card search. The native menu carries no accelerators
  // (see denoApplicationMenu.ts), so a key pressed anywhere in the window can
  // only be caught here - which is also why nothing else in the app claims
  // this combination. preventDefault keeps the WebView from taking it as the
  // system print gesture.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        !event.metaKey || event.ctrlKey || event.altKey || event.shiftKey
      ) {
        return;
      }
      // Both cases of the letter: Caps Lock produces the upper one without
      // Shift being held, and Shift itself is already ruled out above.
      if (event.key !== "p" && event.key !== "P") return;
      // Claimed as soon as the combination is recognised, before deciding
      // whether to act on it: the app owns this key either way, and leaving
      // the default in place for the cases it declines would let the press
      // fall through to the WebView's print gesture.
      event.preventDefault();
      // Two dialogs must never be showModal() at once, and which ones are
      // open is spread across this component, the new-board store and the
      // Markdown viewer. Asking the DOM keeps this correct as dialogs are
      // added, without a store to hold "something is modal" in.
      if (document.querySelector("dialog[open]")) return;
      setIsSearchOpen(true);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Dragging near an edge scrolls the column row, so a card can be carried to
  // a destination that is off-screen when the drag starts. That row is the
  // board's only scrolling region (see App.css), so registering it covers both
  // axes. No canScroll filter is passed: every drag may scroll it.
  useEffect(() => {
    const columnsElement = columnsRef.current;
    if (!columnsElement) return;

    return autoScrollForElements({ element: columnsElement });
  }, []);

  // One monitor for both kinds of drag. Each resolver ignores the other's
  // source type, so the order they are tried in carries no meaning.
  useEffect(() => {
    return monitorForElements({
      onDrop({ source, location }) {
        const dropTargets = location.current.dropTargets;
        const move = resolveMove(source, dropTargets);
        if (move) {
          moveCard(move.from, move.to);
          return;
        }
        const columnMove = resolveColumnMove(source, dropTargets);
        if (columnMove) moveColumn(columnMove.columnId, columnMove.toIndex);
      },
    });
  }, [moveCard, moveColumn]);

  return (
    <div className="kanban-board">
      {
        /* Keyed by path so switching boards (e.g. Open Recent) discards any
          in-progress name edit instead of committing it to the new board. */
      }
      <BoardName key={boardPath} name={board.name} onRename={renameBoard} />
      {saveError && (
        <div className="kanban-board__save-error" role="alert">
          <span>{saveError}</span>
          {saveConflict
            ? (
              <>
                <span>
                  Reload discards changes made in Facet. Overwrite discards
                  changes made outside Facet.
                </span>
                {conflictResolutionError && (
                  <span>{conflictResolutionError}</span>
                )}
                <button type="button" onClick={() => void reloadBoard()}>
                  Reload
                </button>
                <button type="button" onClick={overwriteBoard}>
                  Overwrite
                </button>
              </>
            )
            : <button type="button" onClick={retrySave}>Retry</button>}
        </div>
      )}
      <div ref={columnsRef} className="kanban-board__columns">
        {board.columns.map((column, index) => (
          <Column
            column={column}
            criteria={criteria}
            index={index}
            key={column.id}
            labelColors={labelColors}
            onAddCard={(columnId) => {
              setAddToColumnId(columnId);
              setIsAddCardOpen(true);
            }}
            onDeleteCard={(card) => {
              setDeleteTarget(card);
              setIsDeleteCardOpen(true);
            }}
            onRepairCard={(card) => {
              setRepairTarget(card);
              setIsMissingCardOpen(true);
            }}
            onRename={renameColumn}
            onRemove={removeColumn}
          />
        ))}
        <AddColumn />
      </div>
      {boardPath && addToColumnId && (
        <AddCardDialog
          boardPath={boardPath}
          columnId={addToColumnId}
          open={isAddCardOpen}
          onClose={() => setIsAddCardOpen(false)}
        />
      )}
      {
        /* Mounted before MissingCardDialog for the same reason that dialog is
          mounted before DeleteCardDialog: a search hit for a card whose file
          is broken hands over to the repair dialog. */
      }
      <CardSearchDialog
        board={board}
        criteria={criteria}
        open={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelect={(card) => {
          // The dialog has already closed itself by now; this keeps the state
          // that drives it from depending on the close event to catch up,
          // since a stuck `true` here would swallow the next Cmd+P.
          setIsSearchOpen(false);
          // The same split the card tile makes on click: a broken card has
          // nothing to show in the viewer, so it goes to the repair dialog.
          if (isCardFileBroken(card)) {
            setRepairTarget(card);
            setIsMissingCardOpen(true);
            return;
          }
          // selectCard owns the unsaved-draft confirmation; declining it
          // leaves the board exactly as it was.
          void selectCard(card);
        }}
      />
      {
        /* Mounted before DeleteCardDialog so that when one hands over to the
          other, the effect that closes this dialog runs before the effect that
          opens that one - two dialogs must never be showModal() at once. */
      }
      {boardPath && repairTarget && (
        <MissingCardDialog
          card={repairTarget}
          boardPath={boardPath}
          open={isMissingCardOpen}
          onClose={() => setIsMissingCardOpen(false)}
          onRemoveFromBoard={(card) => {
            setIsMissingCardOpen(false);
            setDeleteTarget(card);
            setIsDeleteCardOpen(true);
          }}
        />
      )}
      {deleteTarget && (
        <DeleteCardDialog
          card={deleteTarget}
          open={isDeleteCardOpen}
          onClose={() => setIsDeleteCardOpen(false)}
        />
      )}
    </div>
  );
}
