import { useCallback, useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import { type Board, findCardByEquivalentPath } from "../../domain/board.ts";
import { findPreviousCard, listRecentCards } from "../../domain/cardHistory.ts";
import type { Card } from "../../domain/card.ts";
import { isCardFileBroken } from "../../domain/card.ts";
import type { CardFilterCriteria } from "../../domain/cardFilter.ts";
import { listRecentCardHits } from "../../domain/cardSearch.ts";
import {
  useBoardSession,
  useBoardStore,
  useBoardView,
  useContextMenu,
  useFilterStore,
  useMarkdownViewer,
} from "../context/appContext.ts";
import { canRefreshBoard } from "../store/boardStore.ts";
import { BoardName } from "./BoardName.tsx";
import { CardContentSearchDialog } from "../search/CardContentSearchDialog.tsx";
import { CardSearchDialog } from "../search/CardSearchDialog.tsx";
import { CardDirectoryView } from "../directory/CardDirectoryView.tsx";
import { CardTable } from "../table/CardTable.tsx";
import { buildBoardContextMenu } from "./boardContextMenus.ts";
import { buildCardContextMenu } from "../shared/cardContextMenu.ts";
import { isInsideDialog } from "../shared/isInsideDialog.ts";
import { isTextEditingTarget } from "../shared/isTextEditingTarget.ts";
import { useMenuActions } from "../shared/useMenuActions.ts";
import { DeleteCardDialog } from "./DeleteCardDialog.tsx";
import { KanbanBoard } from "../kanban/KanbanBoard.tsx";
import { MissingCardDialog } from "./MissingCardDialog.tsx";
import { ViewSwitcher } from "./ViewSwitcher.tsx";
import {
  canSwitchCardFrom,
  resolvePreviousCardShortcut,
} from "../shared/shortcuts/previousCardShortcut.ts";
import { resolveBoardSearchShortcut } from "../shared/shortcuts/boardSearchShortcut.ts";
import {
  EXTERNAL_CHANGE_CONFLICT_DETAIL,
  SaveErrorBanner,
} from "../shared/SaveErrorBanner.tsx";

// Command-[ and the recent list in the title search both read history through
// this test, so the first recent card offered is the one Command-[ opens.
function isOnBoard(board: Board): (path: string) => boolean {
  return (path) => findCardByEquivalentPath(board, path) !== undefined;
}

export function BoardScreen({ board }: { board: Board }) {
  const renameBoard = useBoardStore((state) => state.renameBoard);
  const moveCardToColumn = useBoardStore((state) => state.moveCardToColumn);
  const { copyText, reveal } = useMenuActions();
  const contextMenu = useContextMenu();
  const saveError = useBoardStore((state) => state.saveError);
  const refreshError = useBoardStore((state) => state.refreshError);
  const saveConflict = useBoardStore((state) => state.saveConflict);
  const conflictResolutionError = useBoardStore(
    (state) => state.conflictResolutionError,
  );
  const conflictResolution = useBoardStore((state) => state.conflictResolution);
  const isSaving = useBoardStore((state) => state.isSaving);
  const isRefreshing = useBoardStore((state) => state.isRefreshing);
  const canRefresh = useBoardStore(canRefreshBoard);
  const retrySave = useBoardStore((state) => state.retrySave);
  const refreshBoard = useBoardStore((state) => state.refreshBoard);
  const reloadBoard = useBoardStore((state) => state.reloadBoard);
  const overwriteBoard = useBoardStore((state) => state.overwriteBoard);
  const boardPath = useBoardStore((state) => state.path);
  const mode = useBoardView((state) => state.mode);
  const setMode = useBoardView((state) => state.setMode);
  const criteria = useFilterStore((state) => state.criteria);
  const selectCard = useMarkdownViewer((state) => state.selectCard);
  const { markdownViewer } = useBoardSession();
  const [isTitleSearchOpen, setIsTitleSearchOpen] = useState(false);
  const [isContentSearchOpen, setIsContentSearchOpen] = useState(false);
  // Keep targets after closing so the dialogs stay mounted for native focus
  // restoration and remain renderable while a successful delete closes.
  const [deleteTarget, setDeleteTarget] = useState<Card>();
  const [isDeleteCardOpen, setIsDeleteCardOpen] = useState(false);
  const [repairTarget, setRepairTarget] = useState<Card>();
  const [isMissingCardOpen, setIsMissingCardOpen] = useState(false);

  const openMissingCard = useCallback((card: Card) => {
    setRepairTarget(card);
    setIsMissingCardOpen(true);
  }, []);

  const handleCardSelection = useCallback(
    (card: Card) => {
      // A search dialog hands over after closing itself, and Command-[ only
      // acts while no dialog is open. Clear both drivers anyway so a handoff
      // cannot leave one shortcut swallowed by stale open state.
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
    },
    [openMissingCard, selectCard],
  );

  // The native menu carries no accelerators (see nativeApplicationMenu.ts), so
  // board keys pressed anywhere in the window can only be caught here. Pure
  // resolvers distinguish card switching, title search and content search.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const previousCard = resolvePreviousCardShortcut(event);
      const shortcut = resolveBoardSearchShortcut(event);
      if (!previousCard && !shortcut) return;
      // Claimed as soon as the combination is recognised, before deciding
      // whether to act on it: the app owns these keys, so none falls
      // through to a default action when an existing modal makes it decline.
      event.preventDefault();
      // Board shortcuts do not navigate or open a modal while one is active.
      // Asking the DOM covers dialogs owned by other components too.
      if (document.querySelector("dialog[open]")) return;
      if (previousCard) {
        if (!canSwitchCardFrom(event.target)) return;
        // Read at key time rather than subscribing, so switching cards does
        // not re-register this listener on every visit.
        const { history, selectedPath } = markdownViewer.getState();
        const path = findPreviousCard(history, selectedPath, isOnBoard(board));
        const card =
          path === undefined
            ? undefined
            : findCardByEquivalentPath(board, path);
        if (card) handleCardSelection(card);
        return;
      }
      if (shortcut === "title") {
        setIsTitleSearchOpen(true);
      } else {
        setIsContentSearchOpen(true);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [board, markdownViewer, handleCardSelection]);

  function openDeleteCard(card: Card) {
    setDeleteTarget(card);
    setIsDeleteCardOpen(true);
  }

  function handleCardContextMenu(card: Card, event: MouseEvent<HTMLElement>) {
    if (isTextEditingTarget(event.target)) return;
    event.preventDefault();
    event.stopPropagation();

    contextMenu.show(
      buildCardContextMenu(card, board, {
        copyText,
        reveal,
        moveToColumn: (columnId) => moveCardToColumn(card.path, columnId),
      }),
    );
  }

  function handleBoardContextMenu(event: MouseEvent<HTMLDivElement>) {
    if (!boardPath || isTextEditingTarget(event.target)) return;
    // Dialogs are mounted under BoardScreen but keep WebKit's own menu.
    if (isInsideDialog(event.target)) return;
    event.preventDefault();
    contextMenu.show(
      buildBoardContextMenu(boardPath, canRefresh, {
        copyText,
        reveal,
        refresh: () => void refreshBoard(),
      }),
    );
  }

  return (
    <div className="board-screen" onContextMenu={handleBoardContextMenu}>
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
          {saveConflict ? (
            <>
              <button
                type="button"
                onClick={() => void reloadBoard()}
                disabled={
                  isSaving || isRefreshing || conflictResolution !== undefined
                }
              >
                {conflictResolution === "reloading" ? "Reloading…" : "Reload"}
              </button>
              <button
                type="button"
                onClick={() => void overwriteBoard()}
                disabled={
                  isSaving || isRefreshing || conflictResolution !== undefined
                }
              >
                {conflictResolution === "overwriting"
                  ? "Overwriting…"
                  : "Overwrite"}
              </button>
            </>
          ) : (
            <button type="button" onClick={retrySave} disabled={isRefreshing}>
              Retry
            </button>
          )}
        </SaveErrorBanner>
      )}
      {refreshError && (
        <SaveErrorBanner message={refreshError}>
          <button
            type="button"
            onClick={() => void refreshBoard()}
            disabled={!canRefresh}
          >
            Retry
          </button>
        </SaveErrorBanner>
      )}
      {mode === "board" && (
        <KanbanBoard
          board={board}
          onDeleteCard={openDeleteCard}
          onRepairCard={openMissingCard}
          onCardContextMenu={handleCardContextMenu}
        />
      )}
      {mode === "table" && (
        <CardTable
          board={board}
          onDeleteCard={openDeleteCard}
          onRepairCard={openMissingCard}
          onCardContextMenu={handleCardContextMenu}
        />
      )}
      {mode === "directory" && (
        <CardDirectoryView
          board={board}
          onDeleteCard={openDeleteCard}
          onRepairCard={openMissingCard}
          onCardContextMenu={handleCardContextMenu}
        />
      )}
      {/* A broken search hit hands over to the repair dialog, so search
          dialogs must close before that dialog opens. */}
      <TitleSearch
        board={board}
        criteria={criteria}
        open={isTitleSearchOpen}
        onClose={() => setIsTitleSearchOpen(false)}
        onSelect={handleCardSelection}
      />
      <CardContentSearchDialog
        key={`content-search-${boardPath}`}
        board={board}
        criteria={criteria}
        open={isContentSearchOpen}
        onClose={() => setIsContentSearchOpen(false)}
        onSelect={handleCardSelection}
      />
      {/* Mounted before DeleteCardDialog so that when one hands over to the
          other, the effect that closes this dialog runs before the effect that
          opens that one - these two dialogs must not overlap. */}
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

// Subscribes to the visit history on its own, so opening a card re-renders the
// search dialog rather than the whole board beneath it.
function TitleSearch({
  board,
  criteria,
  open,
  onClose,
  onSelect,
}: {
  board: Board;
  criteria: CardFilterCriteria;
  open: boolean;
  onClose: () => void;
  onSelect: (card: Card) => void;
}) {
  const history = useMarkdownViewer((state) => state.history);
  const currentPath = useMarkdownViewer((state) => state.selectedPath);
  // Recomputed from the latest board, so a rename, move or reload shows here
  // without the history itself being rewritten.
  const recent = useMemo(
    () => listRecentCardHits(board, listRecentCards(history, isOnBoard(board))),
    [board, history],
  );
  return (
    <CardSearchDialog
      board={board}
      criteria={criteria}
      recent={recent}
      currentPath={currentPath}
      open={open}
      onClose={onClose}
      onSelect={onSelect}
    />
  );
}
