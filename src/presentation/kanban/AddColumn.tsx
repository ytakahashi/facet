import { useRef, useState } from "react";
import { useBoardStore } from "../context/appContext.ts";

// Inline form at the right end of the column row. A dialog would be overkill
// for a single name field, so this follows the common kanban pattern of a
// button that expands in place.
export function AddColumn() {
  const addColumn = useBoardStore((state) => state.addColumn);
  const formRef = useRef<HTMLFormElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");

  function closeForm() {
    setIsOpen(false);
    setName("");
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (name.trim() === "") return;
    addColumn(name);
    // Stay open with a cleared input so several columns can be added in a
    // row. The form is the rightmost element of a horizontally scrollable
    // row, so keep it in view after the new column pushes it further right
    // (after the next paint, once the column is laid out).
    setName("");
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }

  if (!isOpen) {
    return (
      <div className="add-column">
        <button
          type="button"
          className="add-column__open"
          onClick={() => setIsOpen(true)}
        >
          + Add column
        </button>
      </div>
    );
  }

  return (
    <div className="add-column">
      <form
        ref={formRef}
        className="add-column__form"
        onSubmit={handleSubmit}
        onKeyDown={(event) => {
          if (event.key === "Escape") closeForm();
        }}
        onBlur={(event) => {
          // Close only when focus leaves the whole form, not when it moves
          // between the input and the buttons.
          if (
            !event.currentTarget.contains(event.relatedTarget as Node | null)
          ) {
            closeForm();
          }
        }}
      >
        <input
          type="text"
          value={name}
          placeholder="Column name"
          aria-label="Column name"
          onChange={(event) => setName(event.target.value)}
          autoFocus
        />
        {
          /* WebKit does not focus a button on click, so without this the
            input's blur would see relatedTarget: null and close the form
            before the button's click is dispatched. Keeping focus on the
            input sidesteps that; the buttons still receive the click. */
        }
        <div
          className="add-column__actions"
          onMouseDown={(event) => event.preventDefault()}
        >
          <button type="submit" disabled={name.trim() === ""}>Add</button>
          <button type="button" onClick={closeForm}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
