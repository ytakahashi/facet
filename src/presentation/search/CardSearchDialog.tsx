import { useEffect, useMemo, useRef, useState } from "react";
import type { Board } from "../../domain/board.ts";
import type { Card as CardModel } from "../../domain/card.ts";
import { isCardFileBroken } from "../../domain/card.ts";
import {
  type CardFilterCriteria,
  isCardHidden,
} from "../../domain/cardFilter.ts";
import {
  type CardSearchHit,
  searchCardsByTitle,
} from "../../domain/cardSearch.ts";
import {
  clampSelectionIndex,
  nextSelectionIndex,
} from "../shared/cardSearchSelection.ts";
import {
  buildCardSearchModel,
  type CardSearchMode,
  type CardSearchRow,
  type CardSearchSectionKind,
} from "./cardSearchModel.ts";

interface CardSearchDialogProps {
  mode: CardSearchMode;
  board: Board;
  criteria: CardFilterCriteria;
  // Most recent first, resolved on the board, current card included.
  recent: readonly CardSearchHit[];
  currentPath: string | undefined;
  open: boolean;
  onClose: () => void;
  onSelect: (card: CardModel) => void;
}

const RESULTS_ID = "card-search-results";

// Shown only for sections the model marks as labelled.
const SECTION_LABELS: Record<CardSearchSectionKind, string> = {
  recent: "Recent",
  all: "All cards",
  results: "Results",
};

// Finds a card by title and opens it, wherever it sits on the board and
// whether or not a filter is currently hiding it. Unlike the filter sidebar,
// this changes nothing about the board: it is a way to reach a card, not a
// statement about which cards belong on screen.
export function CardSearchDialog({
  mode,
  board,
  criteria,
  recent,
  currentPath,
  open,
  onClose,
  onSelect,
}: CardSearchDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const results = useMemo(
    () => (mode === "search" ? searchCardsByTitle(board, query) : []),
    [board, query, mode],
  );
  const model = useMemo(
    () => buildCardSearchModel({ mode, query, results, recent, currentPath }),
    [mode, query, results, recent, currentPath],
  );
  // The stored index can fall outside the list: the results shrink as the
  // query grows, and the board or the history can change while the dialog is
  // open.
  const activeIndex = clampSelectionIndex(selectedIndex, model.options.length);
  const activeOption = model.options[activeIndex];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      // Always reopen empty. A search is about what is being looked for now,
      // and a leftover query would hide most of the board behind a filter
      // nobody typed.
      setQuery("");
      setSelectedIndex(0);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // The result list scrolls, so moving past its edge with the arrow keys
  // would otherwise leave the selection somewhere off-screen. Reopening needs
  // the same: scrolling does nothing while the dialog is closed, and an
  // unchanged model would not run this again once it opens.
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, model, open]);

  const inputLabel =
    mode === "recent" ? "Filter recent cards" : "Search cards by title";
  const emptyMessage =
    mode === "search"
      ? "No cards match"
      : recent.length === 0
        ? "No recent cards"
        : "No recent cards match";

  // Closes the dialog through the element itself rather than leaving it to
  // the open prop coming back as false. What the caller does with the card
  // can run before React re-renders - selecting a card with unsaved changes
  // asks for confirmation synchronously - and that prompt must not appear
  // over a palette that is still on screen. close() also fires the dialog's
  // close event, so the open state still follows.
  function selectAndClose(card: CardModel) {
    dialogRef.current?.close();
    onSelect(card);
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    // An IME is mid-conversion: Enter is confirming a candidate and the
    // arrow keys are moving through them, so none of it is aimed here.
    if (event.nativeEvent.isComposing) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex(
        nextSelectionIndex(
          activeIndex,
          model.options.length,
          event.key === "ArrowDown" ? 1 : -1,
        ),
      );
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (activeOption) selectAndClose(activeOption.hit.card);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="card-search-dialog"
      aria-labelledby={mode === "recent" ? "card-search-title" : undefined}
      // Held on the dialog rather than on the input so the keys keep working
      // if focus ever leaves the input, and Escape stays with onCancel.
      onKeyDown={handleKeyDown}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
    >
      <div className="card-search-dialog__body">
        {mode === "recent" && (
          <h2 id="card-search-title" className="card-search-dialog__title">
            Recent cards
          </h2>
        )}
        <input
          type="text"
          className="card-search-dialog__input"
          role="combobox"
          aria-expanded
          aria-controls={RESULTS_ID}
          aria-activedescendant={activeOption?.id}
          aria-label={inputLabel}
          placeholder={inputLabel}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelectedIndex(0);
          }}
        />
        {model.sections.length === 0 ? (
          <p className="card-search-dialog__empty">{emptyMessage}</p>
        ) : (
          <div
            id={RESULTS_ID}
            role="listbox"
            aria-label={mode === "recent" ? "Recent cards" : "Search results"}
            className="card-search-dialog__results"
            // Nothing in the list is focusable, so a click on it would
            // otherwise pull focus out of the input and stop what is typed
            // next from reaching the query.
            onMouseDown={(event) => event.preventDefault()}
          >
            {model.sections.map((section) => {
              const rows = section.rows.map((row) => (
                <CardSearchRowView
                  key={row.key}
                  row={row}
                  criteria={criteria}
                  isActive={row === activeOption}
                  activeRef={selectedRef}
                  onSelect={selectAndClose}
                />
              ));
              if (!section.labelled) return rows;
              const headingId = `card-search-${section.kind}-heading`;
              return (
                <div
                  key={section.kind}
                  role="group"
                  aria-labelledby={headingId}
                  className="card-search-dialog__group"
                >
                  {/* Names the group through aria-labelledby; presentation
                      keeps it from counting as a row of the listbox. */}
                  <div
                    id={headingId}
                    role="presentation"
                    className="card-search-dialog__group-heading"
                  >
                    {SECTION_LABELS[section.kind]}
                  </div>
                  {rows}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </dialog>
  );
}

function CardSearchRowView({
  row,
  criteria,
  isActive,
  activeRef,
  onSelect,
}: {
  row: CardSearchRow;
  criteria: CardFilterCriteria;
  isActive: boolean;
  activeRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (card: CardModel) => void;
}) {
  const { hit } = row;
  const content = (
    <>
      <span className="card-search-dialog__result-title">
        {hit.card.displayTitle}
      </span>
      <span className="card-search-dialog__result-meta">
        <span className="card-search-dialog__result-column">
          {hit.columnName}
        </span>
        <span className="card-search-dialog__result-path">{hit.card.path}</span>
        {row.kind === "current" && (
          <span className="card-search-dialog__result-note">Current</span>
        )}
        {/* Both notes say why the board looks different from this list:
            one card cannot be opened at all, the other cannot be seen
            where it sits. */}
        {isCardFileBroken(hit.card) && (
          <span className="card-search-dialog__result-note card-search-dialog__result-note--missing">
            Missing
          </span>
        )}
        {isCardHidden(hit.card, hit.columnId, criteria) && (
          <span className="card-search-dialog__result-note">
            Hidden by filters
          </span>
        )}
      </span>
    </>
  );

  // Still an option, so the listbox holds only options and groups, but a
  // disabled one: the keys and the pointer pass over it.
  if (row.kind === "current") {
    return (
      <div
        id={row.id}
        role="option"
        aria-disabled
        className="card-search-dialog__result card-search-dialog__result--current"
      >
        {content}
      </div>
    );
  }
  return (
    <div
      id={row.id}
      role="option"
      aria-selected={isActive}
      ref={isActive ? activeRef : undefined}
      className={
        isActive
          ? "card-search-dialog__result card-search-dialog__result--selected"
          : "card-search-dialog__result"
      }
      onClick={() => onSelect(hit.card)}
    >
      {content}
    </div>
  );
}
