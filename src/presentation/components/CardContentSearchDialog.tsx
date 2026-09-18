import { useEffect, useMemo, useRef, useState } from "react";
import type { Board } from "../../domain/board.ts";
import type { Card as CardModel } from "../../domain/card.ts";
import { isCardFileBroken } from "../../domain/card.ts";
import {
  type CardFilterCriteria,
  isCardHidden,
} from "../../domain/cardFilter.ts";
import { searchCardContents } from "../../domain/cardContentSearch.ts";
import { useCardContentReading } from "../context/appContext.ts";
import { nextSelectionIndex } from "./cardSearchSelection.ts";
import { ContentSearchLine } from "./ContentSearchLine.tsx";
import { createContentReadSequence } from "./contentReadSequence.ts";

interface CardContentSearchDialogProps {
  board: Board;
  criteria: CardFilterCriteria;
  open: boolean;
  onClose: () => void;
  onSelect: (card: CardModel) => void;
}

type ContentReadState =
  | { status: "idle" }
  | { status: "reading" }
  | {
    status: "ready";
    contents: ReadonlyMap<string, string>;
    unreadableCount: number;
  };

const RESULTS_ID = "card-content-search-results";

function optionId(index: number): string {
  return `card-content-search-option-${index}`;
}

// Searches a fresh snapshot of every card's file each time it opens. Query
// and selection remain local because they only help continue a search on this
// board; KanbanBoard remounts the dialog when the board path changes.
export function CardContentSearchDialog(
  { board, criteria, open, onClose, onSelect }: CardContentSearchDialogProps,
) {
  const { read } = useCardContentReading();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedRef = useRef<HTMLLIElement>(null);
  const [sequence] = useState(createContentReadSequence);
  const [query, setQuery] = useState("");
  const [selectedPath, setSelectedPath] = useState<string>();
  const [readState, setReadState] = useState<ContentReadState>({
    status: "idle",
  });

  const results = useMemo(
    () =>
      readState.status === "ready"
        ? searchCardContents(board, readState.contents, query)
        : [],
    [board, query, readState],
  );
  const rememberedIndex = selectedPath === undefined
    ? -1
    : results.findIndex((hit) => hit.card.path === selectedPath);
  const activeIndex = rememberedIndex === -1 ? 0 : rememberedIndex;

  useEffect(() => {
    if (!open) return;

    const generation = sequence.begin();
    const cards = board.columns.flatMap((column) => column.cards);
    setReadState({ status: "reading" });
    void read(cards).then((readResults) => {
      if (!sequence.isCurrent(generation)) return;

      const contents = new Map<string, string>();
      let unreadableCount = 0;
      for (const result of readResults) {
        if (result.read) {
          contents.set(result.path, result.content);
        } else {
          unreadableCount += 1;
        }
      }
      setReadState({ status: "ready", contents, unreadableCount });
    }).catch(() => {
      if (!sequence.isCurrent(generation)) return;
      setReadState({
        status: "ready",
        contents: new Map(),
        unreadableCount: cards.length,
      });
    });

    return () => sequence.invalidate();
  }, [board, open, read, sequence]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      inputRef.current?.focus();
      inputRef.current?.select();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, results]);

  function selectAndClose(card: CardModel) {
    dialogRef.current?.close();
    setSelectedPath(card.path);
    onSelect(card);
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    // Enter confirms an IME candidate and arrows move through candidates while
    // composing, so those keys must not move or open a search result.
    if (event.nativeEvent.isComposing) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const nextIndex = nextSelectionIndex(
        activeIndex,
        results.length,
        event.key === "ArrowDown" ? 1 : -1,
      );
      const hit = results[nextIndex];
      if (hit) setSelectedPath(hit.card.path);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const hit = results[activeIndex];
      if (hit) selectAndClose(hit.card);
    }
  }

  const queryIsEmpty = query.trim() === "";

  return (
    <dialog
      ref={dialogRef}
      className="card-search-dialog card-content-search-dialog"
      onKeyDown={handleKeyDown}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
    >
      <div className="card-search-dialog__body">
        <input
          ref={inputRef}
          type="text"
          className="card-search-dialog__input"
          role="combobox"
          aria-expanded
          aria-controls={RESULTS_ID}
          aria-activedescendant={results.length > 0
            ? optionId(activeIndex)
            : undefined}
          aria-label="Search card contents"
          aria-busy={readState.status === "reading"}
          placeholder="Search card contents"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {readState.status === "reading" && (
          <p className="card-content-search-dialog__status" role="status">
            Reading cards…
          </p>
        )}
        {readState.status === "ready" && !queryIsEmpty &&
          (results.length === 0
            ? <p className="card-search-dialog__empty">No matches</p>
            : (
              <ul
                id={RESULTS_ID}
                role="listbox"
                aria-label="Content search results"
                className="card-search-dialog__results"
                onMouseDown={(event) => event.preventDefault()}
              >
                {results.map((hit, index) => {
                  const remainingLineCount = hit.totalLineCount -
                    hit.lines.length;
                  return (
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
                        {isCardHidden(hit.card, hit.columnId, criteria) && (
                          <span className="card-search-dialog__result-note">
                            Hidden by filters
                          </span>
                        )}
                      </span>
                      <div className="card-content-search-dialog__lines">
                        {hit.lines.map((line) => (
                          <ContentSearchLine
                            key={line.lineNumber}
                            hit={line}
                          />
                        ))}
                      </div>
                      {remainingLineCount > 0 && (
                        <span className="card-content-search-dialog__more">
                          +{remainingLineCount} more
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            ))}
        {readState.status === "ready" && readState.unreadableCount > 0 && (
          <p className="card-content-search-dialog__unreadable">
            {readState.unreadableCount === 1
              ? "1 card could not be read"
              : `${readState.unreadableCount} cards could not be read`}
          </p>
        )}
      </div>
    </dialog>
  );
}
