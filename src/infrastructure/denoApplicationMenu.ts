import type { FileSystemPort } from "../domain/fileSystemPort.ts";

// Mirrors the JSON shape Deno Desktop's win.setApplicationMenu expects.
// Kept local to this file (not imported from a Deno types package) since
// main.ts treats the menu as an opaque pass-through value.
// `enabled` is required on the "item" variant - omitting it made Deno
// Desktop silently drop the entire containing top-level menu on-device
// (confirmed: a File menu with one enabled-less item disappeared while
// sibling menus rendered fine), so it's typed as required here to prevent
// that mistake from recurring.
export type MenuItem =
  | { item: { label: string; id?: string; enabled: boolean } }
  | { submenu: { label: string; items: MenuItem[] } }
  | { role: { role: string } }
  | "separator";

const RECENT_ID_PREFIX = "recent:";
// Fixed id, unlike the index-based recent ids: it stays valid across menu
// rebuilds, so a click can never be misrouted after the history changes.
const NEW_BOARD_ID = "new-board";

export function buildApplicationMenu(
  recentBoardPaths: readonly string[],
  homeDirectory: string,
): { menu: MenuItem[]; pathById: Map<string, string> } {
  const pathById = new Map<string, string>();

  const recentItems: MenuItem[] = recentBoardPaths.length === 0
    ? [{ item: { label: "No Recent Boards", enabled: false } }]
    : recentBoardPaths.map((path, index) => {
      const id = `${RECENT_ID_PREFIX}${index}`;
      pathById.set(id, path);
      return {
        item: { label: labelFor(path, homeDirectory), id, enabled: true },
      };
    });

  const menu: MenuItem[] = [
    {
      // On macOS the first submenu becomes the app menu and its label is
      // replaced with the app name, so "Facet" here is never actually shown.
      submenu: { label: "Facet", items: [{ role: { role: "quit" } }] },
    },
    {
      submenu: {
        label: "File",
        items: [
          { item: { label: "New Board…", id: NEW_BOARD_ID, enabled: true } },
          "separator",
          { submenu: { label: "Open Recent", items: recentItems } },
        ],
      },
    },
    {
      // Replacing the default application menu removes the default Edit
      // menu too, which would otherwise leave textarea shortcuts
      // (Cmd+C/V/Z) non-functional. These role items restore them.
      submenu: {
        label: "Edit",
        items: [
          { role: { role: "undo" } },
          { role: { role: "redo" } },
          "separator",
          { role: { role: "cut" } },
          { role: { role: "copy" } },
          { role: { role: "paste" } },
          { role: { role: "selectAll" } },
        ],
      },
    },
  ];

  return { menu, pathById };
}

function labelFor(path: string, homeDirectory: string): string {
  const lastSlash = path.lastIndexOf("/");
  const name = lastSlash === -1 ? path : path.slice(lastSlash + 1);
  const directory = lastSlash === -1 ? "" : path.slice(0, lastSlash);
  const shortDirectory = directory.startsWith(homeDirectory)
    ? `~${directory.slice(homeDirectory.length)}`
    : directory;
  return `${name} — ${shortDirectory}`;
}

export interface MenuSelectionHandlers {
  newBoard(): void;
  openRecent(path: string): void;
}

export class DenoApplicationMenu {
  private readonly fileSystem: FileSystemPort;
  private pathById = new Map<string, string>();

  constructor(fileSystem: FileSystemPort) {
    this.fileSystem = fileSystem;
  }

  async setRecentBoards(paths: readonly string[]): Promise<void> {
    const home = await this.fileSystem.homeDirectory();
    const { menu, pathById } = buildApplicationMenu(paths, home);
    this.pathById = pathById;
    await bindings.setApplicationMenu(menu);
  }

  // Starts a long-poll loop that dispatches clicked ids to their handlers.
  // Fire-and-forget: the loop ends silently once nextMenuClick() rejects
  // (e.g. bindings unavailable, such as running in a plain browser tab).
  onMenuSelect(handlers: MenuSelectionHandlers): void {
    void this.pollLoop(handlers);
  }

  private async pollLoop(handlers: MenuSelectionHandlers): Promise<void> {
    for (;;) {
      let id: string;
      try {
        id = await bindings.nextMenuClick();
      } catch {
        return;
      }
      if (id === NEW_BOARD_ID) {
        handlers.newBoard();
        continue;
      }
      const path = this.pathById.get(id);
      if (path) {
        handlers.openRecent(path);
      }
    }
  }
}
