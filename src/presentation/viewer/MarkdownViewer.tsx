import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  findCardByEquivalentPath,
  findCardByPath,
} from "../../domain/board.ts";
import { resolveCardLink } from "../../domain/cardLink.ts";
import { findPreviousCard } from "../../domain/cardHistory.ts";
import type { Card } from "../../domain/card.ts";
import { orderCardLabels } from "../../domain/label.ts";
import {
  useBoardStore,
  useClipboard,
  useMarkdownViewer,
  usePaneLayout,
  useShowAlert,
} from "../context/appContext.ts";
import { toUiError } from "../errors/toUiError.ts";
import { isCardSaving, isMarkdownDirty } from "../store/markdownViewerStore.ts";
import { CardTitle } from "./CardTitle.tsx";
import { CardBoardPosition } from "./CardBoardPosition.tsx";
import { buildLabelDisplay } from "../labels/labelDisplay.ts";
import { LabelPickerDialog } from "../labels/LabelPickerDialog.tsx";
import { ManageLabelsDialog } from "../labels/ManageLabelsDialog.tsx";
import { MarkdownEditor } from "./editor/MarkdownEditor.tsx";
import { PaneResizer } from "./PaneResizer.tsx";
import { RenameCardFileDialog } from "./RenameCardFileDialog.tsx";
import {
  EXTERNAL_CHANGE_CONFLICT_DETAIL,
  SaveErrorBanner,
} from "../shared/SaveErrorBanner.tsx";
import {
  clampViewerWidth,
  getAvailableViewerWidth,
  VIEWER_WIDTH_STEP,
} from "./viewerWidth.ts";
import { resolveViewerShortcut } from "./viewerShortcut.ts";

// The Markdown parser is large enough to dominate the initial bundle, while
// edit mode does not need it. Load that dependency only when preview is shown.
const MarkdownPreview = lazy(() =>
  import("./preview/MarkdownPreview.tsx").then((module) => ({
    default: module.MarkdownPreview,
  }))
);

function isEscapeOwnedByField(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("input") !== null;
}

export function MarkdownViewer() {
  const status = useMarkdownViewer((state) => state.status);
  const selectedPath = useMarkdownViewer((state) => state.selectedPath);
  const draft = useMarkdownViewer((state) => state.draft);
  const isDirty = useMarkdownViewer(isMarkdownDirty);
  const error = useMarkdownViewer((state) => state.error);
  // Scoped to the open card: a write still running for a card the user has
  // since navigated away from must not label this card's button "Saving…".
  const isSaving = useMarkdownViewer((state) =>
    state.selectedPath !== undefined &&
    isCardSaving(state, state.selectedPath)
  );
  const saveError = useMarkdownViewer((state) => state.saveError);
  const conflict = useMarkdownViewer((state) => state.conflict);
  const conflictResolutionError = useMarkdownViewer(
    (state) => state.conflictResolutionError,
  );
  const conflictResolution = useMarkdownViewer(
    (state) => state.conflictResolution,
  );
  const canSave = isDirty && !isSaving && conflict === undefined;
  const updateDraft = useMarkdownViewer((state) => state.updateDraft);
  const save = useMarkdownViewer((state) => state.save);
  const reloadFromDisk = useMarkdownViewer((state) => state.reloadFromDisk);
  const overwrite = useMarkdownViewer((state) => state.overwrite);
  const close = useMarkdownViewer((state) => state.close);
  const history = useMarkdownViewer((state) => state.history);
  const goBack = useMarkdownViewer((state) => state.goBack);
  const selectCard = useMarkdownViewer((state) => state.selectCard);

  const width = usePaneLayout((state) => state.viewerWidth);
  const setWidth = usePaneLayout((state) => state.setViewerWidth);
  const resetWidth = usePaneLayout((state) => state.resetViewerWidth);
  const viewerMode = usePaneLayout((state) => state.viewerMode);
  const setViewerMode = usePaneLayout((state) => state.setViewerMode);
  const toggleViewerMode = usePaneLayout((state) => state.toggleViewerMode);
  // Set only when the shortcut switches to edit mode, where the user expects
  // to type next. A button click or opening a card leaves focus where it was,
  // so the request is dropped once the editor has mounted with it.
  const [focusEditorOnMount, setFocusEditorOnMount] = useState(false);
  useEffect(() => {
    if (focusEditorOnMount) setFocusEditorOnMount(false);
  }, [focusEditorOnMount]);
  const handleRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(globalThis.innerWidth);

  // The sidebar sits outside this flex row, so its width changes resize the
  // row itself. The handle ref keeps this measurement independent of CSS names.
  useLayoutEffect(() => {
    const handle = handleRef.current;
    const boardMain = handle?.parentElement;
    if (!handle || !boardMain) {
      throw new Error("The editor resize handle requires a board layout");
    }

    const updateAvailableWidth = () => {
      setAvailableWidth(getAvailableViewerWidth(
        boardMain.getBoundingClientRect().width,
        handle.getBoundingClientRect().width,
      ));
    };
    updateAvailableWidth();

    const observer = new ResizeObserver(updateAvailableWidth);
    observer.observe(boardMain);
    observer.observe(handle);
    return () => observer.disconnect();
  }, []);
  const displayedWidth = clampViewerWidth(width, availableWidth);

  const board = useBoardStore((state) => state.board);
  const boardPath = useBoardStore((state) => state.path);
  const renameCard = useBoardStore((state) => state.renameCard);
  const addCardLabel = useBoardStore((state) => state.addCardLabel);
  const removeCardLabel = useBoardStore((state) => state.removeCardLabel);
  const createLabel = useBoardStore((state) => state.createLabel);
  const renameLabel = useBoardStore((state) => state.renameLabel);
  const setLabelColor = useBoardStore((state) => state.setLabelColor);
  const removeLabel = useBoardStore((state) => state.removeLabel);
  const moveLabel = useBoardStore((state) => state.moveLabel);
  const resolveLink = useCallback((href: string) => {
    if (!board || !selectedPath) return undefined;
    return resolveCardLink(board, selectedPath, href);
  }, [board, selectedPath]);
  const openCard = useCallback((card: Card) => {
    void selectCard(card);
  }, [selectCard]);
  const clipboard = useClipboard();
  const showAlert = useShowAlert();
  // Reports the failure here and still rejects, so the code block keeps
  // showing "Copy" rather than claiming the text was copied.
  const copyCode = useCallback(async (text: string) => {
    try {
      await clipboard.copyText(text);
    } catch (error) {
      showAlert(toUiError(error).message);
      throw error;
    }
  }, [clipboard, showAlert]);
  const card = status === "loaded" && board && selectedPath
    ? findCardByPath(board, selectedPath)
    : undefined;
  const labelDisplay = useMemo(
    () => buildLabelDisplay(board?.labels ?? []),
    [board?.labels],
  );
  const backDestination = useMemo(() => {
    if (!board) return undefined;
    const previous = findPreviousCard(
      history,
      (path) => findCardByEquivalentPath(board, path) !== undefined,
    );
    if (!previous) return undefined;
    const destination = findCardByEquivalentPath(board, previous.path);
    return destination ? { board, card: destination } : undefined;
  }, [board, history]);

  const [isLabelPickerOpen, setIsLabelPickerOpen] = useState(false);
  const [isManageLabelsOpen, setIsManageLabelsOpen] = useState(false);
  // The card is taken into state when the dialog opens rather than read from
  // the board on every render: a successful move takes the old path off the
  // board before the viewer follows it, and a dialog mounted on the lookup
  // would be torn out of the document mid-submit - with its modal still open.
  const [renameFileTarget, setRenameFileTarget] = useState<Card>();
  const [isRenameFileOpen, setIsRenameFileOpen] = useState(false);

  // Matches when the Edit/Preview switch is shown below.
  const canToggleMode = status === "loaded" && draft !== undefined;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const shortcut = resolveViewerShortcut(event);
      if (!shortcut) return;
      const isModalOpen = document.querySelector("dialog[open]") !== null;
      if (shortcut === "close") {
        // Escape is left unclaimed wherever something else owns it: a modal
        // closes on Escape as its default action, which preventDefault would
        // cancel, and single-line fields (card title, column and board names,
        // including those on the board) use it to cancel their own edit. The
        // Markdown textarea has no Escape behaviour, so it still closes here.
        if (isModalOpen || isEscapeOwnedByField(event.target)) return;
        event.preventDefault();
        close();
        return;
      }
      // The viewer owns this shortcut while open, even when there is no back
      // destination, saving is unavailable, or a modal prevents acting on it.
      event.preventDefault();
      if (isModalOpen) return;
      switch (shortcut) {
        case "back":
          if (board) void goBack(board);
          return;
        case "save":
          if (canSave) void save();
          return;
        case "toggle-mode":
          if (!canToggleMode) return;
          if (toggleViewerMode() === "edit") setFocusEditorOnMount(true);
          return;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [board, canSave, canToggleMode, close, goBack, save, toggleViewerMode]);

  // App only mounts this component for an open board, and every non-idle
  // viewer state identifies a selected card. A partial viewer would hide a
  // broken store/composition invariant behind an incomplete UI.
  if (!board || !selectedPath) {
    throw new Error("Markdown viewer requires an open board and selected card");
  }

  return (
    // A fragment so the handle is a flex sibling of the pane rather than a
    // child of it: this pane scrolls, and a handle inside would scroll with
    // the content it is supposed to sit beside.
    <>
      <PaneResizer
        width={displayedWidth}
        handleRef={handleRef}
        availableWidth={availableWidth}
        clamp={clampViewerWidth}
        step={VIEWER_WIDTH_STEP}
        label="Resize the editor pane"
        onResize={setWidth}
        onReset={resetWidth}
      />
      <div className="markdown-viewer" style={{ width: displayedWidth }}>
        <div className="markdown-viewer__header">
          <div className="markdown-viewer__header-main">
            <button
              type="button"
              className="markdown-viewer__back"
              aria-label="Back"
              title={backDestination
                ? `Back to ${backDestination.card.displayTitle} (⌘[)`
                : "Back (⌘[)"}
              disabled={!backDestination}
              onClick={() => {
                if (backDestination) void goBack(backDestination.board);
              }}
            >
              ←
            </button>
            {card && (
              <CardTitle
                key={card.path}
                card={card}
                onRename={renameCard}
              />
            )}
          </div>
          <div className="markdown-viewer__header-actions">
            <button
              type="button"
              title="Save (⌘S)"
              onClick={save}
              disabled={!canSave}
            >
              {isSaving ? "Saving…" : "Save"}
            </button>
            <button type="button" title="Close (Esc)" onClick={close}>
              Close
            </button>
          </div>
        </div>

        {card && <CardBoardPosition board={board} cardPath={card.path} />}

        {card && (
          <div className="markdown-viewer__meta">
            <div className="markdown-viewer__labels">
              {orderCardLabels(card.labels, labelDisplay.positions).map((
                label,
              ) => (
                <span
                  className={`card__label card__label--${
                    labelDisplay.colors.get(label) ?? "neutral"
                  }`}
                  key={label}
                >
                  {label}
                </span>
              ))}
              <button
                type="button"
                className="markdown-viewer__labels-button"
                onClick={() => setIsLabelPickerOpen(true)}
              >
                Labels…
              </button>
            </div>
          </div>
        )}

        {card && (
          <div className="markdown-viewer__path">
            {
              /* The board-relative path, the same form the board file stores. The
            absolute path goes in the tooltip: it is what the user needs when
            leaving for Finder or another editor, but it is too long to sit in
            this row. */
            }
            <span
              className="markdown-viewer__path-text"
              title={card.absolutePath}
            >
              {card.path}
            </span>
            {
              /* Not "Rename…": this app already renames the card's title from
              the heading above, and the two are independent. */
            }
            <button
              type="button"
              className="markdown-viewer__path-button"
              onClick={() => {
                setRenameFileTarget(card);
                setIsRenameFileOpen(true);
              }}
            >
              Rename or move…
            </button>
          </div>
        )}

        {
          /* Both dialogs below are keyed by a card path so their input state
          does not survive into the next card, and both sit in this same list
          of children - so each key carries what it identifies. Two siblings
          holding the same key breaks reconciliation, and an open modal caught
          by that is left behind in the document, blocking the whole window. */
        }
        {renameFileTarget && boardPath && (
          <RenameCardFileDialog
            key={`rename-file-${renameFileTarget.path}`}
            card={renameFileTarget}
            boardPath={boardPath}
            open={isRenameFileOpen}
            onClose={() => setIsRenameFileOpen(false)}
          />
        )}

        {card && board && (
          <LabelPickerDialog
            key={`labels-${card.path}`}
            card={card}
            labels={board.labels}
            open={isLabelPickerOpen}
            onClose={() => setIsLabelPickerOpen(false)}
            onAddCardLabel={addCardLabel}
            onRemoveCardLabel={removeCardLabel}
            onCreateLabel={createLabel}
            onManageLabels={() => setIsManageLabelsOpen(true)}
          />
        )}

        {
          /* The one place two modals are stacked: Manage Labels opens over
          the picker, so closing it lands back on a picker showing the
          updated registry. Escape reaches only the topmost dialog, and the
          picker is modal-blocked meanwhile. Keyed for the reason above. */
        }
        <ManageLabelsDialog
          key="manage-labels"
          board={board}
          open={isManageLabelsOpen}
          onClose={() => setIsManageLabelsOpen(false)}
          onCreateLabel={createLabel}
          onRenameLabel={renameLabel}
          onSetLabelColor={setLabelColor}
          onRemoveLabel={removeLabel}
          onMoveLabel={moveLabel}
        />

        {saveError && conflict
          ? (
            <SaveErrorBanner
              message={saveError}
              detail={conflict === "changed"
                ? EXTERNAL_CHANGE_CONFLICT_DETAIL
                : "Recreate writes the Markdown shown in Facet back to this path."}
              resolutionError={conflictResolutionError}
            >
              {conflict === "changed" && (
                <button
                  type="button"
                  onClick={reloadFromDisk}
                  disabled={isSaving || conflictResolution !== undefined}
                >
                  {conflictResolution === "reloading" ? "Reloading…" : "Reload"}
                </button>
              )}
              <button
                type="button"
                onClick={overwrite}
                disabled={isSaving || conflictResolution !== undefined}
              >
                {conflictResolution === "overwriting"
                  ? (conflict === "gone" ? "Recreating…" : "Overwriting…")
                  : (conflict === "gone" ? "Recreate" : "Overwrite")}
              </button>
            </SaveErrorBanner>
          )
          : saveError && <SaveErrorBanner message={saveError} />}
        {status === "loading" && (
          <p className="markdown-viewer__placeholder">Loading…</p>
        )}
        {status === "error" && error && <p role="alert">{error}</p>}
        {status === "loaded" && draft !== undefined && (
          <>
            <div
              className="markdown-viewer__mode-switch"
              role="group"
              aria-label="Markdown view"
            >
              <button
                type="button"
                aria-pressed={viewerMode === "edit"}
                title="Edit (⌘E)"
                onClick={() => setViewerMode("edit")}
              >
                Edit
              </button>
              <button
                type="button"
                aria-pressed={viewerMode === "preview"}
                title="Preview (⌘E)"
                onClick={() => setViewerMode("preview")}
              >
                Preview
              </button>
            </div>
            {viewerMode === "edit"
              ? (
                <MarkdownEditor
                  value={draft}
                  onChange={updateDraft}
                  board={board}
                  fromPath={selectedPath}
                  autoFocus={focusEditorOnMount}
                />
              )
              : (
                <Suspense
                  fallback={
                    <p className="markdown-viewer__placeholder">
                      Loading preview…
                    </p>
                  }
                >
                  <MarkdownPreview
                    markdown={draft}
                    resolveLink={resolveLink}
                    onOpenCard={openCard}
                    onCopyCode={copyCode}
                  />
                </Suspense>
              )}
          </>
        )}
      </div>
    </>
  );
}
