import { useEffect, useMemo, useRef, useState } from "react";
import type { Board } from "../../domain/board.ts";
import type { Card as CardModel } from "../../domain/card.ts";
import { isCardFileBroken } from "../../domain/card.ts";
import {
  type CardFilterCriteria,
  isCardHidden,
} from "../../domain/cardFilter.ts";
import { searchCardsByTitle } from "../../domain/cardSearch.ts";
import {
  clampSelectionIndex,
  nextSelectionIndex,
} from "./cardSearchSelection.ts";

interface CardSearchDialogProps {
  board: Board;
  criteria: CardFilterCriteria;
  open: boolean;
  onClose: () => void;
  onSelect: (card: CardModel) => void;
}

const RESULTS_ID = "card-search-results";

function optionId(index: number): string {
  return `card-search-option-${index}`;
}

// Finds a card by title and opens it, wherever it sits on the board and
// whether or not a filter is currently hiding it. Unlike the filter sidebar,
// this changes nothing about the board: it is a way to reach a card, not a
// statement about which cards belong on screen.
export function CardSearchDialog(
  { board, criteria, open, onClose, onSelect }: CardSearchDialogProps,
) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const selectedRef = useRef<HTMLLIElement>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const results = useMemo(
    () => searchCardsByTitle(board, query),
    [board, query],
  );
  // The stored index can fall outside the list: the results shrink as the
  // query grows, and the board itself can change while the dialog is open.
  const activeIndex = clampSelectionIndex(selectedIndex, results.length);

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
  // would otherwise leave the selection somewhere off-screen.
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, results]);

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
          results.length,
          event.key === "ArrowDown" ? 1 : -1,
        ),
      );
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const hit = results[activeIndex];
      if (hit) selectAndClose(hit.card);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="card-search-dialog"
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
        <input
          type="text"
          className="card-search-dialog__input"
          role="combobox"
          aria-expanded
          aria-controls={RESULTS_ID}
          aria-activedescendant={results.length > 0
            ? optionId(activeIndex)
            : undefined}
          aria-label="Search cards by title"
          placeholder="Search cards by title"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelectedIndex(0);
          }}
        />
        {results.length === 0
          ? <p className="card-search-dialog__empty">No cards match</p>
          : (
            <ul
              id={RESULTS_ID}
              role="listbox"
              aria-label="Search results"
              className="card-search-dialog__results"
              // Nothing in the list is focusable, so a click on it would
              // otherwise pull focus out of the input and stop what is typed
              // next from reaching the query.
              onMouseDown={(event) => event.preventDefault()}
            >
              {results.map((hit, index) => (
                <li
                  key={hit.card.path}
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === activeIndex}
                  ref={index === activeIndex ? selectedRef : undefined}
                  className={index === activeIndex
                    ? "card-search-dialog__result card-search-dialog__result--selected"
                    : "card-search-dialog__result"}
                  onClick={() => selectAndClose(hit.card)}
                >
                  <span className="card-search-dialog__result-title">
                    {hit.card.displayTitle}
                  </span>
                  <span className="card-search-dialog__result-meta">
                    <span className="card-search-dialog__result-column">
                      {hit.columnName}
                    </span>
                    <span className="card-search-dialog__result-path">
                      {hit.card.path}
                    </span>
                    {
                      /* Both notes say why the board looks different from
                        this list: one card cannot be opened at all, the
                        other cannot be seen where it sits. */
                    }
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
                </li>
              ))}
            </ul>
          )}
      </div>
    </dialog>
  );
}
