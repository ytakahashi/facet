import { useEffect, useState } from "react";
import type { Board } from "../../domain/board.ts";
import type { Card } from "../../domain/card.ts";
import { isCardFileBroken } from "../../domain/card.ts";
import {
  useBoardStore,
  useBoardView,
  useFilterStore,
  useMarkdownViewer,
} from "../context/appContext.ts";
import { BoardName } from "./BoardName.tsx";
import { CardContentSearchDialog } from "./CardContentSearchDialog.tsx";
import { CardSearchDialog } from "./CardSearchDialog.tsx";
import { CardTable } from "./CardTable.tsx";
import { DeleteCardDialog } from "./DeleteCardDialog.tsx";
import { KanbanBoard } from "./KanbanBoard.tsx";
import { MissingCardDialog } from "./MissingCardDialog.tsx";
import { ViewSwitcher } from "./ViewSwitcher.tsx";
import { resolveBoardSearchShortcut } from "./boardSearchShortcut.ts";
import {
  EXTERNAL_CHANGE_CONFLICT_DETAIL,
  SaveErrorBanner,
} from "./SaveErrorBanner.tsx";

export function BoardScreen({ board }: { board: Board }) {
  const renameBoard = useBoardStore((state) => state.renameBoard);
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
  const mode = useBoardView((state) => state.mode);
  const setMode = useBoardView((state) => state.setMode);
  const criteria = useFilterStore((state) => state.criteria);
  const selectCard = useMarkdownViewer((state) => state.selectCard);
  const [isTitleSearchOpen, setIsTitleSearchOpen] = useState(false);
  const [isContentSearchOpen, setIsContentSearchOpen] = useState(false);
  // Keep targets after closing so the dialogs stay mounted for native focus
  // restoration and remain renderable while a successful delete closes.
  const [deleteTarget, setDeleteTarget] = useState<Card>();
  const [isDeleteCardOpen, setIsDeleteCardOpen] = useState(false);
  const [repairTarget, setRepairTarget] = useState<Card>();
  const [isMissingCardOpen, setIsMissingCardOpen] = useState(false);

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
      // Search shortcuts do not open another modal while one is active.
      // Asking the DOM covers dialogs owned by other components too.
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

  function openDeleteCard(card: Card) {
    setDeleteTarget(card);
    setIsDeleteCardOpen(true);
  }

  function openMissingCard(card: Card) {
    setRepairTarget(card);
    setIsMissingCardOpen(true);
  }

  function handleSearchSelect(card: Card) {
    // Each search dialog has already closed itself by now. Clear both drivers
    // so this handoff cannot leave one shortcut swallowed by stale open state.
    setIsTitleSearchOpen(false);
    setIsContentSearchOpen(false);
    // The same split the card tile makes on click: a broken card has nothing
    // to show in the viewer, so it goes to the repair dialog.
    if (isCardFileBroken(card)) {
      openMissingCard(card);
      return;
    }
    // selectCard owns the unsaved-draft confirmation; declining it leaves the
    // board exactly as it was.
    void selectCard(card);
  }

  return (
    <div className="board-screen">
      <div className="board-screen__header">
        <BoardName name={board.name} onRename={renameBoard} />
        <ViewSwitcher mode={mode} onChange={setMode} />
      </div>
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
      {mode === "board"
        ? (
          <KanbanBoard
            board={board}
            onDeleteCard={openDeleteCard}
            onRepairCard={openMissingCard}
          />
        )
        : (
          <CardTable
            board={board}
            onDeleteCard={openDeleteCard}
            onRepairCard={openMissingCard}
          />
        )}
      {
        /* A broken search hit hands over to the repair dialog, so search
          dialogs must close before that dialog opens. */
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
          opens that one - these two dialogs must not overlap. */
      }
      {boardPath && repairTarget && (
        <MissingCardDialog
          card={repairTarget}
          boardPath={boardPath}
          open={isMissingCardOpen}
          onClose={() => setIsMissingCardOpen(false)}
          onRemoveFromBoard={(card) => {
            setIsMissingCardOpen(false);
            openDeleteCard(card);
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
