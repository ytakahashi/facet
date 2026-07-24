import type { LabelDefinition } from "../../domain/label.ts";

interface LabelFilterListProps {
  labels: LabelDefinition[];
  selected: ReadonlySet<string>;
  onToggle: (name: string) => void;
}

// Display-only checkbox list for the filter sidebar. Reuses the same
// .card__label--{color} badge as Card/MarkdownViewer so a label always
// looks the same everywhere. Creating/renaming/recoloring/deleting labels
// stays LabelPickerDialog's job; this component only reads the registry.
export function LabelFilterList(
  { labels, selected, onToggle }: LabelFilterListProps,
) {
  if (labels.length === 0) {
    return <p className="label-filter-list__empty">No labels yet</p>;
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
