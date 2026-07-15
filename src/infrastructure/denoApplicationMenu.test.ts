import { describe, expect, it } from "vitest";
import type { MenuItem } from "./denoApplicationMenu.ts";
import { buildApplicationMenu } from "./denoApplicationMenu.ts";

function asSubmenuItems(item: MenuItem): MenuItem[] {
  if (typeof item === "string" || !("submenu" in item)) {
    throw new Error("expected a submenu item");
  }
  return item.submenu.items;
}

function recentBoardItems(menu: MenuItem[]): MenuItem[] {
  const fileItems = asSubmenuItems(menu[1]);
  return asSubmenuItems(fileItems[0]);
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

  it("nests the recent boards under an Open Recent submenu inside File", () => {
    const { menu } = buildApplicationMenu(
      ["/Users/me/notes/development.board.yaml"],
      "/Users/me",
    );

    const fileItems = asSubmenuItems(menu[1]);
    expect(fileItems).toHaveLength(1);
    const openRecent = fileItems[0];
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
