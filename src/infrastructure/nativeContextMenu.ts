import {
  Menu,
  type MenuItemOptions,
  type PredefinedMenuItemOptions,
  type SubmenuOptions,
} from "@tauri-apps/api/menu";
import { LogicalPosition } from "@tauri-apps/api/dpi";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type {
  ContextMenu,
  ContextMenuEntry,
  ContextMenuPosition,
} from "../domain/contextMenuPort.ts";

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
      case "copy":
        // The host's own Copy goes to the web view that holds the selection,
        // so the pasteboard gets what Cmd+C would put there, formatting
        // included. The selection's text alone would lose that.
        return { item: "Copy" };
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

// On macOS, Tauri places a popup relative to the window's content view, which
// spans the title bar, while viewport coordinates start below it. The content
// view's height (innerSize) minus the webview's height is that bar: about 32px
// in a window, and 0 in full screen. outerSize equals innerSize here, so the
// difference between those two does not measure it.
async function titleBarHeight(): Promise<number> {
  const appWindow = getCurrentWindow();
  const [inner, scale] = await Promise.all([
    appWindow.innerSize(),
    appWindow.scaleFactor(),
  ]);
  return Math.max(0, inner.height / scale - globalThis.innerHeight);
}

export class NativeContextMenu implements ContextMenu {
  private current?: Menu;

  // Fire-and-forget: a chosen entry's action is the only outcome, and a
  // dismissed menu reports nothing to wait for.
  //
  // An explicit position is shifted down by the title bar (see titleBarHeight).
  // Without one the menu opens at the pointer, which needs no correction.
  show(entries: readonly ContextMenuEntry[], at?: ContextMenuPosition): void {
    void this.open(entries, at).catch((error) => {
      console.warn("Failed to show the context menu:", error);
    });
  }

  private async open(
    entries: readonly ContextMenuEntry[],
    at?: ContextMenuPosition,
  ): Promise<void> {
    const menu = await Menu.new({ items: buildContextMenu(entries) });
    const previous = this.current;
    this.current = menu;
    // The menu shown before is no longer on screen; release its host
    // resources. A click it had not yet delivered is dropped with it.
    await previous?.close();
    if (at) {
      const offset = await titleBarHeight();
      await menu.popup(new LogicalPosition(at.x, at.y + offset));
    } else {
      await menu.popup();
    }
  }
}
