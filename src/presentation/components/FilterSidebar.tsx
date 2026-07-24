import { useEffect } from "react";
import type { Board } from "../../domain/board.ts";
import { isCardFilterActive } from "../../domain/cardFilter.ts";
import { useBoardStore, useFilterStore } from "../context/appContext.ts";
import { LabelFilterList } from "./LabelFilterList.tsx";
import { PriorityPicker } from "./PriorityPicker.tsx";

export function FilterSidebar({ board }: { board: Board }) {
  const boardPath = useBoardStore((state) => state.path);
  const criteria = useFilterStore((state) => state.criteria);
  const isSidebarOpen = useFilterStore((state) => state.isSidebarOpen);
  const toggleSidebar = useFilterStore((state) => state.toggleSidebar);
  const toggleLabel = useFilterStore((state) => state.toggleLabel);
  const setPriority = useFilterStore((state) => state.setPriority);
  const syncLabels = useFilterStore((state) => state.syncLabels);
  const clear = useFilterStore((state) => state.clear);

  useEffect(() => {
    clear();
  }, [boardPath, clear]);

  // board.labels only gets a new array reference when the registry itself
  // changes (create/rename/recolor/delete) - other board updates (add
  // card, move card, ...) leave it untouched - so this only re-runs on
  // registry mutations, not on every board change.
  useEffect(() => {
    syncLabels(new Set(board.labels.map((label) => label.name)));
  }, [board.labels, syncLabels]);

  if (!isSidebarOpen) {
    return (
      <aside className="filter-sidebar filter-sidebar--collapsed">
        <button
          type="button"
          className="filter-sidebar__toggle"
          aria-label="Expand filters"
          title="Expand filters"
          onClick={toggleSidebar}
        >
          ›
        </button>
      </aside>
    );
  }

  return (
    <aside className="filter-sidebar" aria-label="Card filters">
      <div className="filter-sidebar__header">
        <h2>Filters</h2>
        <div className="filter-sidebar__actions">
          {isCardFilterActive(criteria) && (
            <button
              type="button"
              className="filter-sidebar__clear"
              onClick={clear}
            >
              Clear
            </button>
          )}
          <button
            type="button"
            className="filter-sidebar__toggle"
            aria-label="Collapse filters"
            title="Collapse filters"
            onClick={toggleSidebar}
          >
            ‹
          </button>
        </div>
      </div>
      <section className="filter-sidebar__section">
        <h3 className="filter-sidebar__section-title">Priority</h3>
        <PriorityPicker
          priority={criteria.priority}
          onChange={setPriority}
          emptyLabel="All"
        />
      </section>
      <section className="filter-sidebar__section">
        <h3 className="filter-sidebar__section-title">Labels</h3>
        <LabelFilterList
          labels={board.labels}
          selected={criteria.labels}
          onToggle={toggleLabel}
        />
      </section>
    </aside>
  );
}
