import type { LabelColor } from "../../domain/label.ts";

interface CardLabelChipsProps {
  labels: readonly string[];
  colors: ReadonlyMap<string, LabelColor>;
  selected: ReadonlySet<string>;
  onToggle: (name: string) => void;
}

// The card's labels, each toggling the board's label filter. Expects the
// labels already ordered (orderCardLabels).
export function CardLabelChips({
  labels,
  colors,
  selected,
  onToggle,
}: CardLabelChipsProps) {
  return labels.map((label) => {
    const color = colors.get(label);
    // A name missing from the registry stays inert: the filter sidebar lists
    // only registered labels, so it could not be unselected there, and
    // syncLabels drops it at the next registry change anyway.
    if (!color) {
      return (
        <span className="card__label card__label--neutral" key={label}>
          {label}
        </span>
      );
    }
    const isSelected = selected.has(label);
    return (
      <button
        type="button"
        className={`card__label card__label--${color} markdown-viewer__label-toggle`}
        key={label}
        aria-pressed={isSelected}
        title={
          isSelected
            ? `Remove "${label}" from the filter`
            : `Filter by "${label}"`
        }
        onClick={() => onToggle(label)}
      >
        {label}
      </button>
    );
  });
}
