import type { LabelDefinition } from "../../domain/label.ts";

interface LabelFilterListProps {
  labels: LabelDefinition[];
  selected: ReadonlySet<string>;
  onToggle: (name: string) => void;
  onManageLabels: () => void;
}

// Display-only checkbox list for the filter sidebar. Reuses the same
// .card__label--{color} badge as Card/MarkdownViewer so a label always
// looks the same everywhere. Registry management stays with the dialog;
// this list only exposes a callback for its empty-state entry.
export function LabelFilterList(
  { labels, selected, onToggle, onManageLabels }: LabelFilterListProps,
) {
  if (labels.length === 0) {
    return (
      <button
        type="button"
        className="label-filter-list__empty"
        onClick={onManageLabels}
      >
        No labels yet
      </button>
    );
  }

  return (
    <div className="label-filter-list" role="group" aria-label="Labels">
      {labels.map((label) => (
        <label className="label-filter-list__option" key={label.name}>
          <input
            type="checkbox"
            checked={selected.has(label.name)}
            onChange={() =>
              onToggle(label.name)}
          />
          <span className={`card__label card__label--${label.color}`}>
            {label.name}
          </span>
        </label>
      ))}
    </div>
  );
}
