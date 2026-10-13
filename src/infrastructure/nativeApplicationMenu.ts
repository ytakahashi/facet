import {
  Menu,
  type MenuItemOptions,
  type PredefinedMenuItemOptions,
  type SubmenuOptions,
} from "@tauri-apps/api/menu";
import type { FileSystemPort } from "../domain/fileSystemPort.ts";

export type ApplicationMenuItem =
  | MenuItemOptions
  | SubmenuOptions
  | PredefinedMenuItemOptions;

export interface MenuSelectionHandlers {
  newBoard(): void;
  openRecent(path: string): void;
}

// Plain option objects for Tauri's Menu.new(), so the menu's shape can be
// checked without a host. Each item carries its own action: a click arrives
// as a call, not as an id to look up, so a click can never be routed to a
// recent board the menu no longer lists.
export function buildApplicationMenu(
  recentBoardPaths: readonly string[],
  homeDirectory: string,
  handlers: MenuSelectionHandlers,
): ApplicationMenuItem[] {
  const recentItems: ApplicationMenuItem[] = recentBoardPaths.length === 0
    ? [{ text: "No Recent Boards", enabled: false }]
    : recentBoardPaths.map((path) => ({
      text: labelFor(path, homeDirectory),
      action: () => handlers.openRecent(path),
    }));

  return [
    {
      // On macOS the first submenu becomes the app menu and its label is
      // replaced with the app name, so "Facet" here is never actually shown.
      text: "Facet",
      items: [{ item: "Quit" }],
    },
    {
      text: "File",
      items: [
        { text: "New Board…", action: () => handlers.newBoard() },
        { item: "Separator" },
        { text: "Open Recent", items: recentItems },
      ],
    },
    {
      // Replacing the default application menu removes the default Edit
      // menu too, which would otherwise leave textarea shortcuts
      // (Cmd+C/V/Z) non-functional. These predefined items restore them.
      text: "Edit",
      items: [
        { item: "Undo" },
        { item: "Redo" },
        { item: "Separator" },
        { item: "Cut" },
        { item: "Copy" },
        { item: "Paste" },
        { item: "SelectAll" },
      ],
    },
  ];
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

export class NativeApplicationMenu {
  private readonly fileSystem: FileSystemPort;
  // Read at click time rather than captured when the menu is built, so a menu
  // set before onMenuSelect still reaches the handlers registered later.
  private handlers?: MenuSelectionHandlers;
  // The menu this instance last set, under the resource id Menu.new() gave it.
  private current?: Menu;

  constructor(fileSystem: FileSystemPort) {
    this.fileSystem = fileSystem;
  }

  async setRecentBoards(paths: readonly string[]): Promise<void> {
    const home = await this.fileSystem.homeDirectory();
    const menu = await Menu.new({
      items: buildApplicationMenu(paths, home, {
        newBoard: () => this.handlers?.newBoard(),
        openRecent: (path) => this.handlers?.openRecent(path),
      }),
    });
    const replaced = await menu.setAsAppMenu();
    const created = this.current;
    this.current = menu;
    // Each menu holds host resources until closed, and the replaced one is
    // held twice: setAsAppMenu() hands it back under a new resource id, while
    // the id it was created with stays registered as well. Closing only the
    // returned handle would leave one menu behind on every update.
    await Promise.all([replaced?.close(), created?.close()]);
  }

  onMenuSelect(handlers: MenuSelectionHandlers): void {
    this.handlers = handlers;
  }
}
