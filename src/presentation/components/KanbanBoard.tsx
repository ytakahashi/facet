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
import { CardContentSearchDialog } from "./CardContentSearchDialog.tsx";
import { CardSearchDialog } from "./CardSearchDialog.tsx";
import { DeleteCardDialog } from "./DeleteCardDialog.tsx";
import { MissingCardDialog } from "./MissingCardDialog.tsx";
import { resolveBoardSearchShortcut } from "./boardSearchShortcut.ts";
import {
  EXTERNAL_CHANGE_CONFLICT_DETAIL,
  SaveErrorBanner,
} from "./SaveErrorBanner.tsx";

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
  const conflictResolution = useBoardStore(
    (state) => state.conflictResolution,
  );
  const isSaving = useBoardStore((state) => state.isSaving);
  const retrySave = useBoardStore((state) => state.retrySave);
  const reloadBoard = useBoardStore((state) => state.reloadBoard);
  const overwriteBoard = useBoardStore((state) => state.overwriteBoard);
  const boardPath = useBoardStore((state) => state.path);
  const criteria = useFilterStore((state) => state.criteria);
  const selectCard = useMarkdownViewer((state) => state.selectCard);
  const [isTitleSearchOpen, setIsTitleSearchOpen] = useState(false);
  const [isContentSearchOpen, setIsContentSearchOpen] = useState(false);
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

  // The native menu carries no accelerators (see denoApplicationMenu.ts), so
  // search keys pressed anywhere in the window can only be caught here. The
  // pure resolver owns the modifier split between title and content search.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const shortcut = resolveBoardSearchShortcut(event);
      if (!shortcut) return;
      // Claimed as soon as the combination is recognised, before deciding
      // whether to act on it: the app owns both search keys, so neither falls
      // through to a default action when an existing modal makes it decline.
      event.preventDefault();
      // Two dialogs must never be showModal() at once, and which ones are
      // open is spread across this component, the new-board store and the
      // Markdown viewer. Asking the DOM keeps this correct as dialogs are
      // added, without a store to hold "something is modal" in.
      if (document.querySelector("dialog[open]")) return;
      if (shortcut === "title") {
        setIsTitleSearchOpen(true);
      } else {
        setIsContentSearchOpen(true);
      }
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

  function handleSearchSelect(card: CardModel) {
    // Each search dialog has already closed itself by now. Clear both drivers
    // so this handoff cannot leave one shortcut swallowed by stale open state.
    setIsTitleSearchOpen(false);
    setIsContentSearchOpen(false);
    // The same split the card tile makes on click: a broken card has nothing
    // to show in the viewer, so it goes to the repair dialog.
    if (isCardFileBroken(card)) {
      setRepairTarget(card);
      setIsMissingCardOpen(true);
      return;
    }
    // selectCard owns the unsaved-draft confirmation; declining it leaves the
    // board exactly as it was.
    void selectCard(card);
  }

  return (
    <div className="kanban-board">
      <BoardName name={board.name} onRename={renameBoard} />
      {saveError && (
        <SaveErrorBanner
          message={saveError}
          detail={saveConflict ? EXTERNAL_CHANGE_CONFLICT_DETAIL : undefined}
          resolutionError={conflictResolutionError}
        >
          {saveConflict
            ? (
              <>
                <button
                  type="button"
                  onClick={() => void reloadBoard()}
                  disabled={isSaving || conflictResolution !== undefined}
                >
                  {conflictResolution === "reloading" ? "Reloading…" : "Reload"}
                </button>
                <button
                  type="button"
                  onClick={overwriteBoard}
                  disabled={isSaving || conflictResolution !== undefined}
                >
                  {conflictResolution === "overwriting"
                    ? "Overwriting…"
                    : "Overwrite"}
                </button>
              </>
            )
            : <button type="button" onClick={retrySave}>Retry</button>}
        </SaveErrorBanner>
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
        open={isTitleSearchOpen}
        onClose={() => setIsTitleSearchOpen(false)}
        onSelect={handleSearchSelect}
      />
      <CardContentSearchDialog
        key={`content-search-${boardPath}`}
        board={board}
        criteria={criteria}
        open={isContentSearchOpen}
        onClose={() => setIsContentSearchOpen(false)}
        onSelect={handleSearchSelect}
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
