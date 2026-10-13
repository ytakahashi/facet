import { Menu } from "@tauri-apps/api/menu";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { FileSystemPort } from "../domain/fileSystemPort.ts";
import {
  type ApplicationMenuItem,
  buildApplicationMenu,
  type MenuSelectionHandlers,
  NativeApplicationMenu,
} from "./nativeApplicationMenu.ts";

vi.mock("@tauri-apps/api/menu");

afterEach(() => {
  vi.resetAllMocks();
});

function submenuItems(item: ApplicationMenuItem): ApplicationMenuItem[] {
  if (!("items" in item) || !item.items) {
    throw new Error("expected a submenu item");
  }
  return item.items as ApplicationMenuItem[];
}

function fileMenuItems(menu: ApplicationMenuItem[]): ApplicationMenuItem[] {
  return submenuItems(menu[1]);
}

function recentBoardItems(
  menu: ApplicationMenuItem[],
): ApplicationMenuItem[] {
  return submenuItems(fileMenuItems(menu)[2]);
}

function select(item: ApplicationMenuItem): void {
  if (!("action" in item) || !item.action) {
    throw new Error("expected an item with an action");
  }
  item.action("");
}

function makeHandlers(): MenuSelectionHandlers {
  return { newBoard: vi.fn(), openRecent: vi.fn() };
}

describe("buildApplicationMenu", () => {
  it("lists recent boards in order and opens the one selected", () => {
    const handlers = makeHandlers();
    const menu = buildApplicationMenu(
      [
        "/Users/me/notes/development.board.yaml",
        "/Users/me/notes/private.board.yaml",
      ],
      "/Users/me",
      handlers,
    );

    const items = recentBoardItems(menu);
    expect(items.map((item) => "text" in item && item.text)).toEqual([
      "development.board.yaml — ~/notes",
      "private.board.yaml — ~/notes",
    ]);
    select(items[1]);
    expect(handlers.openRecent).toHaveBeenCalledWith(
      "/Users/me/notes/private.board.yaml",
    );
  });

  it("shows a disabled placeholder when there is no history", () => {
    const menu = buildApplicationMenu([], "/Users/me", makeHandlers());

    expect(recentBoardItems(menu)).toEqual([
      { text: "No Recent Boards", enabled: false },
    ]);
  });

  it("keeps paths outside the home directory unshortened", () => {
    const menu = buildApplicationMenu(
      ["/Volumes/external/board.yaml"],
      "/Users/me",
      makeHandlers(),
    );

    expect(recentBoardItems(menu)).toMatchObject([
      { text: "board.yaml — /Volumes/external" },
    ]);
  });

  it("leads the File menu with New Board followed by the Open Recent submenu", () => {
    const handlers = makeHandlers();
    const menu = buildApplicationMenu([], "/Users/me", handlers);

    const fileItems = fileMenuItems(menu);
    expect(fileItems).toHaveLength(3);
    expect(fileItems[0]).toMatchObject({ text: "New Board…" });
    expect(fileItems[1]).toEqual({ item: "Separator" });
    expect(fileItems[2]).toMatchObject({ text: "Open Recent" });
    select(fileItems[0]);
    expect(handlers.newBoard).toHaveBeenCalledOnce();
  });

  it("includes the standard Edit items for textarea shortcuts", () => {
    const menu = buildApplicationMenu([], "/Users/me", makeHandlers());

    expect(submenuItems(menu[2])).toEqual([
      { item: "Undo" },
      { item: "Redo" },
      { item: "Separator" },
      { item: "Cut" },
      { item: "Copy" },
      { item: "Paste" },
      { item: "SelectAll" },
    ]);
  });
});

describe("NativeApplicationMenu", () => {
  function makeFileSystem(): FileSystemPort {
    return {
      readTextFile: vi.fn(),
      readTextFileWithRevision: vi.fn(),
      writeTextFile: vi.fn(),
      removeFile: vi.fn(),
      renameFile: vi.fn(),
      createTextFile: vi.fn(),
      readDir: vi.fn(),
      homeDirectory: vi.fn().mockResolvedValue("/Users/me"),
      exists: vi.fn(),
      mkdir: vi.fn(),
    };
  }

  interface FakeMenu {
    close: ReturnType<typeof vi.fn>;
    setAsAppMenu: ReturnType<typeof vi.fn>;
  }

  // Mirrors the host: setAsAppMenu() returns the menu it replaced under a new
  // resource id - a separate handle from the one that menu was created with.
  function stubMenus() {
    const created: FakeMenu[] = [];
    const replaced: { close: ReturnType<typeof vi.fn> }[] = [];
    vi.mocked(Menu.new).mockImplementation(() => {
      const menu: FakeMenu = {
        close: vi.fn().mockResolvedValue(undefined),
        setAsAppMenu: vi.fn(() => {
          const handle = { close: vi.fn().mockResolvedValue(undefined) };
          replaced.push(handle);
          return Promise.resolve(handle);
        }),
      };
      created.push(menu);
      return Promise.resolve(menu as never);
    });
    return { created, replaced };
  }

  function builtItems(): ApplicationMenuItem[] {
    const options = vi.mocked(Menu.new).mock.lastCall?.[0];
    return (options?.items ?? []) as ApplicationMenuItem[];
  }

  it("releases every handle of the menus it replaces", async () => {
    const { created, replaced } = stubMenus();
    const applicationMenu = new NativeApplicationMenu(makeFileSystem());

    await applicationMenu.setRecentBoards([]);
    await applicationMenu.setRecentBoards(["/Users/me/a.board.yaml"]);
    await applicationMenu.setRecentBoards(["/Users/me/b.board.yaml"]);

    expect(created.map((menu) => menu.setAsAppMenu.mock.calls.length))
      .toEqual([1, 1, 1]);
    expect(replaced.every((handle) => handle.close.mock.calls.length === 1))
      .toBe(true);
    expect(created.map((menu) => menu.close.mock.calls.length))
      .toEqual([1, 1, 0]);
  });

  it("routes clicks to handlers registered after the menu was set", async () => {
    stubMenus();
    const applicationMenu = new NativeApplicationMenu(makeFileSystem());
    await applicationMenu.setRecentBoards([
      "/Users/me/notes/development.board.yaml",
    ]);
    const handlers = makeHandlers();

    applicationMenu.onMenuSelect(handlers);
    select(recentBoardItems(builtItems())[0]);
    select(fileMenuItems(builtItems())[0]);

    expect(handlers.openRecent).toHaveBeenCalledWith(
      "/Users/me/notes/development.board.yaml",
    );
    expect(handlers.newBoard).toHaveBeenCalledOnce();
  });
});
