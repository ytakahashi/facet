import { useShortcutHelp } from "../context/appContext.ts";

export function ShortcutHelpButton() {
  const open = useShortcutHelp((state) => state.open);
  return (
    <button
      type="button"
      className="shortcut-help-button"
      aria-label="Keyboard shortcuts"
      title="Keyboard shortcuts (?)"
      onClick={open}
    >
      ?
    </button>
  );
}
