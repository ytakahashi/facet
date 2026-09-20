import { useEffect, useMemo, useRef, useState } from "react";
import type { Board } from "../../domain/board.ts";
import { isSameCardPath } from "../../domain/boardPath.ts";
import { isLinkableCardPath } from "../../domain/cardLink.ts";
import type { Card as CardModel } from "../../domain/card.ts";
import { isCardFileBroken } from "../../domain/card.ts";
import { searchCardsByTitle } from "../../domain/cardSearch.ts";
import {
  clampSelectionIndex,
  nextSelectionIndex,
} from "./cardSearchSelection.ts";

interface InsertCardLinkDialogProps {
  board: Board;
  fromPath: string;
  open: boolean;
  onClose: () => void;
  onSelect: (card: CardModel) => void;
}

const RESULTS_ID = "insert-card-link-results";

function optionId(index: number): string {
  return `insert-card-link-option-${index}`;
}

export function InsertCardLinkDialog(
  { board, fromPath, open, onClose, onSelect }: InsertCardLinkDialogProps,
) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const selectedRef = useRef<HTMLLIElement>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const results = useMemo(
    () =>
      searchCardsByTitle(board, query).filter((hit) =>
        isLinkableCardPath(hit.card.path) &&
        !isSameCardPath(hit.card.path, fromPath)
      ),
    [board, fromPath, query],
  );
  const activeIndex = clampSelectionIndex(selectedIndex, results.length);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      // Every insertion starts from the whole board. A query left from the
      // previous link would make valid destinations appear to be missing.
      setQuery("");
      setSelectedIndex(0);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    // Arrow-key movement can carry the selection beyond the visible part of
    // the result list, so keep the active row inside its scroll viewport.
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, results]);

  function selectAndClose(card: CardModel) {
    // Close before the selection callback can cause another synchronous UI,
    // such as an unsaved-changes prompt, to appear over this palette.
    dialogRef.current?.close();
    onSelect(card);
  }

  function handleKeyDown(event: React.KeyboardEvent) {
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
          aria-label="Insert a link to a card"
          placeholder="Insert a link to a card"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelectedIndex(0);
          }}
        />
        {results.length === 0
          ? <p className="card-search-dialog__empty">No cards to link</p>
          : (
            <ul
              id={RESULTS_ID}
              role="listbox"
              aria-label="Cards to link"
              className="card-search-dialog__results"
              // Result rows are not focusable. Keep focus in the input so
              // typing immediately after a click still updates the query.
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
                    {isCardFileBroken(hit.card) && (
                      <span className="card-search-dialog__result-note card-search-dialog__result-note--missing">
                        Missing
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
