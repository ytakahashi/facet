import type { Priority } from "../../domain/priority.ts";

const PRIORITIES: Priority[] = ["low", "medium", "high"];

interface PriorityPickerProps {
  priority: Priority | undefined;
  onChange: (priority: Priority | undefined) => void;
}

// Fixed 4-option segment (None + the 3 Priority values). Selection commits
// immediately, so unlike CardTitle/ColumnHeader there is no local editing
// state to hold.
export function PriorityPicker({ priority, onChange }: PriorityPickerProps) {
  return (
    <div className="priority-picker" role="group" aria-label="Priority">
      <button
        type="button"
        className={priority === undefined ? "is-selected" : undefined}
        aria-pressed={priority === undefined}
        onClick={() => onChange(undefined)}
      >
        None
      </button>
      {PRIORITIES.map((option) => (
        <button
          key={option}
          type="button"
          className={`priority-picker__option priority-picker__option--${option}${
            priority === option ? " is-selected" : ""
          }`}
          aria-pressed={priority === option}
          onClick={() => onChange(option)}
        >
          {option[0].toUpperCase() + option.slice(1)}
        </button>
      ))}
    </div>
  );
}
