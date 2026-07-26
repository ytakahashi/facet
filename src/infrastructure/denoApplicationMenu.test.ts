import { afterEach, describe, expect, it, vi } from "vitest";
import type { FileSystemPort } from "../domain/fileSystemPort.ts";
import type { MenuItem } from "./denoApplicationMenu.ts";
import {
  buildApplicationMenu,
  DenoApplicationMenu,
} from "./denoApplicationMenu.ts";

function asSubmenuItems(item: MenuItem): MenuItem[] {
  if (typeof item === "string" || !("submenu" in item)) {
    throw new Error("expected a submenu item");
  }
  return item.submenu.items;
}

function fileMenuItems(menu: MenuItem[]): MenuItem[] {
  return asSubmenuItems(menu[1]);
}

function recentBoardItems(menu: MenuItem[]): MenuItem[] {
  return asSubmenuItems(fileMenuItems(menu)[2]);
}

function editItems(menu: MenuItem[]): MenuItem[] {
  return asSubmenuItems(menu[2]);
}

describe("buildApplicationMenu", () => {
  it("numbers recent board ids in order and maps them back to their paths", () => {
    const { menu, pathById } = buildApplicationMenu(
      [
        "/Users/me/notes/development.board.yaml",
        "/Users/me/notes/private.board.yaml",
      ],
      "/Users/me",
    );

    const items = recentBoardItems(menu);
    expect(items).toEqual([
      {
        item: {
          label: "development.board.yaml — ~/notes",
          id: "recent:0",
          enabled: true,
        },
      },
      {
        item: {
          label: "private.board.yaml — ~/notes",
          id: "recent:1",
          enabled: true,
        },
      },
    ]);
    expect(pathById).toEqual(
      new Map([
        ["recent:0", "/Users/me/notes/development.board.yaml"],
        ["recent:1", "/Users/me/notes/private.board.yaml"],
      ]),
    );
  });

  it("shows a disabled placeholder and an empty pathById when there is no history", () => {
    const { menu, pathById } = buildApplicationMenu([], "/Users/me");

    const items = recentBoardItems(menu);
    expect(items).toEqual([
      { item: { label: "No Recent Boards", enabled: false } },
    ]);
    expect(pathById.size).toBe(0);
  });

  it("keeps paths outside the home directory unshortened", () => {
    const { menu } = buildApplicationMenu(
      ["/Volumes/external/board.yaml"],
      "/Users/me",
    );

    const items = recentBoardItems(menu);
    expect(items).toEqual([
      {
        item: {
          label: "board.yaml — /Volumes/external",
          id: "recent:0",
          enabled: true,
        },
      },
    ]);
  });

  it("leads the File menu with New Board followed by the Open Recent submenu", () => {
    const { menu } = buildApplicationMenu(
      ["/Users/me/notes/development.board.yaml"],
      "/Users/me",
    );

    const fileItems = fileMenuItems(menu);
    expect(fileItems).toHaveLength(3);
    expect(fileItems[0]).toEqual({
      item: { label: "New Board…", id: "new-board", enabled: true },
    });
    expect(fileItems[1]).toBe("separator");
    const openRecent = fileItems[2];
    if (typeof openRecent === "string" || !("submenu" in openRecent)) {
      throw new Error("expected the Open Recent submenu");
    }
    expect(openRecent.submenu.label).toBe("Open Recent");
  });

  it("includes the standard Edit role items for textarea shortcuts", () => {
    const { menu } = buildApplicationMenu([], "/Users/me");

    expect(editItems(menu)).toEqual([
      { role: { role: "undo" } },
      { role: { role: "redo" } },
      "separator",
      { role: { role: "cut" } },
      { role: { role: "copy" } },
      { role: { role: "paste" } },
      { role: { role: "selectAll" } },
    ]);
  });
});

describe("DenoApplicationMenu.onMenuSelect", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function makeFileSystem(): FileSystemPort {
    return {
      readTextFile: vi.fn(),
      writeTextFile: vi.fn(),
      removeFile: vi.fn(),
      createTextFile: vi.fn(),
      readDir: vi.fn(),
      homeDirectory: vi.fn().mockResolvedValue("/Users/me"),
      exists: vi.fn(),
      mkdir: vi.fn(),
    };
  }

  it("dispatches new-board and recent clicks to their handlers", async () => {
    const nextMenuClick = vi.fn<() => Promise<string>>()
      .mockResolvedValueOnce("new-board")
      .mockResolvedValueOnce("recent:0")
      .mockRejectedValue(new Error("loop stopped"));
    vi.stubGlobal("bindings", {
      setApplicationMenu: vi.fn().mockResolvedValue(undefined),
      nextMenuClick,
    });
    const applicationMenu = new DenoApplicationMenu(makeFileSystem());
    await applicationMenu.setRecentBoards([
      "/Users/me/notes/development.board.yaml",
    ]);
    const newBoard = vi.fn();
    const openRecent = vi.fn();

    applicationMenu.onMenuSelect({ newBoard, openRecent });
    await vi.waitFor(() => expect(openRecent).toHaveBeenCalled());

    expect(newBoard).toHaveBeenCalledTimes(1);
    expect(openRecent).toHaveBeenCalledWith(
      "/Users/me/notes/development.board.yaml",
    );
  });

  it("ignores clicks whose id matches no handler", async () => {
    const nextMenuClick = vi.fn<() => Promise<string>>()
      .mockResolvedValueOnce("recent:99")
      .mockResolvedValueOnce("new-board")
      .mockRejectedValue(new Error("loop stopped"));
    vi.stubGlobal("bindings", {
      setApplicationMenu: vi.fn().mockResolvedValue(undefined),
      nextMenuClick,
    });
    const applicationMenu = new DenoApplicationMenu(makeFileSystem());
    await applicationMenu.setRecentBoards([
      "/Users/me/notes/development.board.yaml",
    ]);
    const newBoard = vi.fn();
    const openRecent = vi.fn();

    applicationMenu.onMenuSelect({ newBoard, openRecent });
    await vi.waitFor(() => expect(newBoard).toHaveBeenCalled());

    expect(openRecent).not.toHaveBeenCalled();
  });
});
