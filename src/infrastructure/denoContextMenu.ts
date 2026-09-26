import type { MenuItem } from "./denoMenuItem.ts";

export type ContextMenuEntry =
  | { kind: "item"; label: string; enabled: boolean; onSelect: () => void }
  | { kind: "submenu"; label: string; entries: readonly ContextMenuEntry[] }
  | { kind: "separator" };

export interface ContextMenuPosition {
  x: number;
  y: number;
}

const ID_PREFIX = "context:";

// The generation is part of every id because a dismissed menu reports
// nothing: the table can only be replaced when the next menu is shown, and
// without it a late click from an earlier menu would carry an id that now
// names an item at the same position in a different menu.
export function buildContextMenu(
  entries: readonly ContextMenuEntry[],
  generation: number,
): { menu: MenuItem[]; handlerById: Map<string, () => void> } {
  const handlerById = new Map<string, () => void>();

  function toMenuItems(list: readonly ContextMenuEntry[]): MenuItem[] {
    return list.map((entry): MenuItem => {
      switch (entry.kind) {
        case "separator":
          return "separator";
        case "submenu":
          // How Deno Desktop renders a submenu with no items is unknown, so
          // an empty one is shown as a disabled item instead.
          if (entry.entries.length === 0) {
            return { item: { label: entry.label, enabled: false } };
          }
          return {
            submenu: { label: entry.label, items: toMenuItems(entry.entries) },
          };
        case "item": {
          if (!entry.enabled) {
            return { item: { label: entry.label, enabled: false } };
          }
          const id = `${ID_PREFIX}${generation}:${handlerById.size}`;
          handlerById.set(id, entry.onSelect);
          return { item: { label: entry.label, id, enabled: true } };
        }
      }
    });
  }

  return { menu: toMenuItems(entries), handlerById };
}

export class DenoContextMenu {
  private generation = 0;
  private handlerById = new Map<string, () => void>();

  // Fire-and-forget: the click, if any, arrives through the poll loop, and a
  // dismissed menu reports nothing to wait for.
  show(position: ContextMenuPosition, entries: readonly ContextMenuEntry[]) {
    this.generation += 1;
    const { menu, handlerById } = buildContextMenu(entries, this.generation);
    this.handlerById = handlerById;
    bindings.showContextMenu(position.x, position.y, menu).catch((error) => {
      console.warn("Failed to show the context menu:", error);
    });
  }

  // Starts a long-poll loop that dispatches clicked ids to the handlers of the
  // menu shown last. Call once: the host queue serves a single waiter. The
  // loop ends silently once nextContextMenuClick() rejects (e.g. bindings
  // unavailable, such as running in a plain browser tab).
  start(): void {
    void this.pollLoop();
  }

  private async pollLoop(): Promise<void> {
    for (;;) {
      let id: string;
      try {
        id = await bindings.nextContextMenuClick();
      } catch {
        return;
      }
      // A handler that throws is a bug, but letting it end the loop would
      // leave every later menu without a way to deliver its clicks.
      try {
        this.handlerById.get(id)?.();
      } catch (error) {
        console.error("A context menu handler failed:", error);
      }
    }
  }
}
