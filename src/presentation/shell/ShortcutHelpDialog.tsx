import { Fragment, useEffect, useRef } from "react";
import { useShortcutHelp } from "../context/appContext.ts";
import { isTextEditingTarget } from "../shared/isTextEditingTarget.ts";
import { resolveHelpShortcut } from "../shared/shortcuts/helpShortcut.ts";
import {
  formatKeyCombo,
  shortcutGroups,
} from "../shared/shortcuts/shortcutCatalog.ts";

export function ShortcutHelpDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const isOpen = useShortcutHelp((state) => state.isOpen);
  const open = useShortcutHelp((state) => state.open);
  const close = useShortcutHelp((state) => state.close);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    else if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!resolveHelpShortcut(event) || event.defaultPrevented) return;
      // Leave text entry and native modal key handling untouched.
      if (
        isTextEditingTarget(event.target) ||
        document.querySelector("dialog[open]")
      )
        return;
      event.preventDefault();
      open();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="shortcut-help-dialog"
      aria-labelledby="shortcut-help-title"
      onCancel={close}
      onClose={close}
    >
      <div className="shortcut-help-dialog__content">
        <header className="shortcut-help-dialog__header">
          <h2 id="shortcut-help-title">Keyboard Shortcuts</h2>
          <button
            type="button"
            aria-label="Close keyboard shortcuts"
            onClick={close}
            autoFocus
          >
            ×
          </button>
        </header>
        <div className="shortcut-help-dialog__groups">
          {shortcutGroups.map((group) => (
            <section key={group.title}>
              <h3>{group.title}</h3>
              <dl>
                {group.entries.map((entry) => (
                  <div key={entry.id} className="shortcut-help-dialog__entry">
                    <dt>{entry.description}</dt>
                    <dd>
                      {entry.combos.map((combo, index) => (
                        <Fragment key={index}>
                          {index > 0 && " / "}
                          <span className="shortcut-help-dialog__combo">
                            {formatKeyCombo(combo).map((key, keyIndex) => (
                              <kbd key={keyIndex}>{key}</kbd>
                            ))}
                            {combo.context && (
                              <span className="shortcut-help-dialog__context">
                                {combo.context}
                              </span>
                            )}
                          </span>
                        </Fragment>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </dialog>
  );
}
