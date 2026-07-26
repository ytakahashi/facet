import type { Column } from "../../domain/board.ts";

interface ColumnFilterListProps {
  columns: Column[];
  hiddenColumnIds: ReadonlySet<string>;
  onToggle: (columnId: string) => void;
}

// Display-only checkbox list for the filter sidebar, mirroring
// LabelFilterList: a checked box means the column's cards are visible, and
// toggling reports straight to the caller without any local state. Adding,
// renaming and removing columns stays the column header's job; this
// component only reads the board's columns.
export function ColumnFilterList(
  { columns, hiddenColumnIds, onToggle }: ColumnFilterListProps,
) {
  if (columns.length === 0) {
    return <p className="column-filter-list__empty">No columns yet</p>;
  }

  return (
    <div className="column-filter-list" role="group" aria-label="Columns">
      {columns.map((column) => (
        <label className="column-filter-list__option" key={column.id}>
          <input
            type="checkbox"
            checked={!hiddenColumnIds.has(column.id)}
            onChange={() =>
              onToggle(column.id)}
          />
          <span className="column-filter-list__name" title={column.name}>
            {column.name}
          </span>
        </label>
      ))}
    </div>
  );
}
