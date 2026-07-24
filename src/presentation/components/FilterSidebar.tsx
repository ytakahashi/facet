import { useEffect } from "react";
import { isCardFilterActive } from "../../domain/cardFilter.ts";
import { useBoardStore, useFilterStore } from "../context/appContext.ts";
import { PriorityPicker } from "./PriorityPicker.tsx";

export function FilterSidebar() {
  const boardPath = useBoardStore((state) => state.path);
  const criteria = useFilterStore((state) => state.criteria);
  const isSidebarOpen = useFilterStore((state) => state.isSidebarOpen);
  const toggleSidebar = useFilterStore((state) => state.toggleSidebar);
  const setPriority = useFilterStore((state) => state.setPriority);
  const clear = useFilterStore((state) => state.clear);

  useEffect(() => {
    clear();
  }, [boardPath, clear]);

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
    </aside>
  );
}
