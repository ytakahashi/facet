import { useEffect, useMemo, useRef } from "react";
import type { Board } from "../../domain/board.ts";
import type { Card } from "../../domain/card.ts";
import { isCardFileBroken } from "../../domain/card.ts";
import { listCardTableRows } from "../../domain/cardTable.ts";
import type { CardTableSortKey } from "../../domain/cardTable.ts";
import { orderCardLabels } from "../../domain/label.ts";
import {
  useBoardView,
  useFilterStore,
  useMarkdownViewer,
} from "../context/appContext.ts";
import { missingHint } from "./cardFileStateHint.ts";
import { buildLabelDisplay } from "./labelDisplay.ts";

interface CardTableProps {
  board: Board;
  onDeleteCard: (card: Card) => void;
  onRepairCard: (card: Card) => void;
}

const columns: { key: CardTableSortKey; title: string }[] = [
  { key: "title", title: "Title" },
  { key: "labels", title: "Labels" },
  { key: "column", title: "Column" },
  { key: "priority", title: "Priority" },
  { key: "path", title: "Path" },
];

export function CardTable(
  { board, onDeleteCard, onRepairCard }: CardTableProps,
) {
  const criteria = useFilterStore((state) => state.criteria);
  const tableSort = useBoardView((state) => state.tableSort);
  const cycleTableSort = useBoardView((state) => state.cycleTableSort);
  const selectedPath = useMarkdownViewer((state) => state.selectedPath);
  const selectCard = useMarkdownViewer((state) => state.selectCard);
  const selectedRowRef = useRef<HTMLTableRowElement>(null);
  const rows = useMemo(
    () => listCardTableRows(board, criteria, tableSort),
    [board, criteria, tableSort],
  );
  const labelDisplay = useMemo(
    () => buildLabelDisplay(board.labels),
    [board.labels],
  );
  const selectedIndex = rows.findIndex((row) => row.card.path === selectedPath);

  // Keyed on the selected row's position rather than on `rows`: rows is rebuilt
  // on every board change, and following that would pull a user who scrolled
  // away back to the selection whenever an unrelated edit or a save lands.
  useEffect(() => {
    if (selectedIndex !== -1) {
      selectedRowRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex, selectedPath]);

  function openCard(card: Card) {
    if (isCardFileBroken(card)) {
      onRepairCard(card);
    } else {
      void selectCard(card);
    }
  }

  const hasCards = board.columns.some((column) => column.cards.length > 0);

  return (
    <div className="card-table" role="region" aria-label="Cards">
      <table>
        <thead>
          <tr>
            {columns.map(({ key, title }) => (
              <th
                key={key}
                scope="col"
                aria-sort={tableSort?.key === key
                  ? tableSort.direction === "asc" ? "ascending" : "descending"
                  : "none"}
              >
                <button type="button" onClick={() => cycleTableSort(key)}>
                  {title}
                  {tableSort?.key === key && (
                    <span aria-hidden="true">
                      {tableSort.direction === "asc" ? " ▲" : " ▼"}
                    </span>
                  )}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ card, column }) => {
            const isBroken = isCardFileBroken(card);
            const isSelected = selectedPath === card.path;
            return (
              <tr
                key={card.path}
                ref={isSelected ? selectedRowRef : undefined}
                className={isSelected
                  ? "card-table__row card-table__row--selected"
                  : "card-table__row"}
                onClick={() => openCard(card)}
              >
                <td>
                  <div className="card-table__title-cell">
                    <button
                      type="button"
                      className="card-table__open"
                      onClick={(event) => {
                        event.stopPropagation();
                        openCard(card);
                      }}
                    >
                      {card.displayTitle}
                    </button>
                    {isBroken && (
                      <span
                        className="card__missing"
                        title={missingHint(card.fileState)}
                      >
                        Missing
                      </span>
                    )}
                    <button
                      type="button"
                      className="card-table__delete"
                      aria-label={`Delete ${card.displayTitle}`}
                      title="Delete card"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteCard(card);
                      }}
                    >
                      ×
                    </button>
                  </div>
                </td>
                <td>
                  <div className="card__labels">
                    {orderCardLabels(card.labels, labelDisplay.positions).map(
                      (label) => (
                        <span
                          className={`card__label card__label--${
                            labelDisplay.colors.get(label) ?? "neutral"
                          }`}
                          key={label}
                        >
                          {label}
                        </span>
                      ),
                    )}
                  </div>
                </td>
                <td>{column.name}</td>
                <td>
                  {card.priority && (
                    <span
                      className={`card__priority card__priority--${card.priority}`}
                    >
                      {card.priority}
                    </span>
                  )}
                </td>
                <td className="card-table__path" title={card.path}>
                  <span>{card.path}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="card-table__empty">
          {hasCards
            ? "No cards match the filter."
            : "No cards yet. Add cards from the Board view."}
        </p>
      )}
    </div>
  );
}
