import { useEffect, useState } from "react";
import type { Board } from "../../domain/board.ts";
import { isCardFilterActive } from "../../domain/cardFilter.ts";
import { useBoardStore, useFilterStore } from "../context/appContext.ts";
import { ColumnFilterList } from "./ColumnFilterList.tsx";
import { LabelFilterList } from "./LabelFilterList.tsx";
import { ManageLabelsDialog } from "./ManageLabelsDialog.tsx";
import { PriorityPicker } from "./PriorityPicker.tsx";

export function FilterSidebar({ board }: { board: Board }) {
  const [isManageLabelsOpen, setIsManageLabelsOpen] = useState(false);
  const createLabel = useBoardStore((state) => state.createLabel);
  const renameLabel = useBoardStore((state) => state.renameLabel);
  const setLabelColor = useBoardStore((state) => state.setLabelColor);
  const removeLabel = useBoardStore((state) => state.removeLabel);
  const moveLabel = useBoardStore((state) => state.moveLabel);
  const boardPath = useBoardStore((state) => state.path);
  const criteria = useFilterStore((state) => state.criteria);
  const isSidebarOpen = useFilterStore((state) => state.isSidebarOpen);
  const toggleSidebar = useFilterStore((state) => state.toggleSidebar);
  const toggleLabel = useFilterStore((state) => state.toggleLabel);
  const toggleColumnVisibility = useFilterStore(
    (state) => state.toggleColumnVisibility,
  );
  const setPriority = useFilterStore((state) => state.setPriority);
  const syncLabels = useFilterStore((state) => state.syncLabels);
  const clear = useFilterStore((state) => state.clear);

  useEffect(() => {
    clear();
  }, [boardPath, clear]);

  // board.labels only gets a new array reference when the registry itself
  // changes (create/rename/recolor/delete/reorder) - other board updates (add
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
          {isCardFilterActive(board, criteria) && (
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
        <div className="filter-sidebar__section-heading">
          <h3 className="filter-sidebar__section-title">Labels</h3>
          <button type="button" onClick={() => setIsManageLabelsOpen(true)}>
            Manage
          </button>
        </div>
        <LabelFilterList
          labels={board.labels}
          selected={criteria.labels}
          onToggle={toggleLabel}
          onManageLabels={() => setIsManageLabelsOpen(true)}
        />
      </section>
      <section className="filter-sidebar__section">
        <h3 className="filter-sidebar__section-title">Columns</h3>
        <ColumnFilterList
          columns={board.columns}
          hiddenColumnIds={criteria.hiddenColumnIds}
          onToggle={toggleColumnVisibility}
        />
      </section>
      <ManageLabelsDialog
        board={board}
        open={isManageLabelsOpen}
        onClose={() => setIsManageLabelsOpen(false)}
        onCreateLabel={createLabel}
        onRenameLabel={renameLabel}
        onSetLabelColor={setLabelColor}
        onRemoveLabel={removeLabel}
        onMoveLabel={moveLabel}
      />
    </aside>
  );
}
