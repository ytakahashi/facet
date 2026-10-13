import {
  Menu,
  type MenuItemOptions,
  type PredefinedMenuItemOptions,
  type SubmenuOptions,
} from "@tauri-apps/api/menu";

export type ContextMenuEntry =
  | { kind: "item"; label: string; enabled: boolean; onSelect: () => void }
  | { kind: "submenu"; label: string; entries: readonly ContextMenuEntry[] }
  | { kind: "separator" };

export type ContextMenuItem =
  | MenuItemOptions
  | SubmenuOptions
  | PredefinedMenuItemOptions;

// A handler that throws is a bug, but it must not take the click's error out
// through the host's event delivery; it is reported and dropped here.
function runSafely(onSelect: () => void): void {
  try {
    onSelect();
  } catch (error) {
    console.error("A context menu handler failed:", error);
  }
}

// Plain option objects for Tauri's Menu.new(). Each item carries its own
// action, bound to the entry it was built from, so a click can never be
// routed to whatever sits at the same position in a different menu.
export function buildContextMenu(
  entries: readonly ContextMenuEntry[],
): ContextMenuItem[] {
  return entries.map((entry): ContextMenuItem => {
    switch (entry.kind) {
      case "separator":
        return { item: "Separator" };
      case "submenu":
        // An empty submenu would open onto nothing, so it is shown as a
        // disabled item instead.
        if (entry.entries.length === 0) {
          return { text: entry.label, enabled: false };
        }
        return { text: entry.label, items: buildContextMenu(entry.entries) };
      case "item":
        if (!entry.enabled) return { text: entry.label, enabled: false };
        return { text: entry.label, action: () => runSafely(entry.onSelect) };
    }
  });
}

export class NativeContextMenu {
  private current?: Menu;

  // Fire-and-forget: a chosen entry's action is the only outcome, and a
  // dismissed menu reports nothing to wait for.
  //
  // The menu opens at the mouse pointer. Every context menu here is opened by
  // a right click, so that is where the pointer is. Passing the event's
  // clientX/clientY instead puts the menu one title-bar height too high: the
  // host measures from the top of the window's content view, which includes
  // the title bar, while client coordinates start below it.
  show(entries: readonly ContextMenuEntry[]): void {
    void this.open(entries).catch((error) => {
      console.warn("Failed to show the context menu:", error);
    });
  }

  private async open(entries: readonly ContextMenuEntry[]): Promise<void> {
    const menu = await Menu.new({ items: buildContextMenu(entries) });
    const previous = this.current;
    this.current = menu;
    // The menu shown before is no longer on screen; release its host
    // resources. A click it had not yet delivered is dropped with it.
    await previous?.close();
    await menu.popup();
  }
}
