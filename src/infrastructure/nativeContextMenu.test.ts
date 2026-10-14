import { Menu } from "@tauri-apps/api/menu";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  buildContextMenu,
  type ContextMenuEntry,
  type ContextMenuItem,
  NativeContextMenu,
} from "./nativeContextMenu.ts";

vi.mock("@tauri-apps/api/menu");

afterEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

function item(label: string, onSelect = vi.fn()): ContextMenuEntry {
  return { kind: "item", label, enabled: true, onSelect };
}

function select(menuItem: ContextMenuItem | undefined): void {
  if (!menuItem || !("action" in menuItem) || !menuItem.action) {
    throw new Error("expected an item with an action");
  }
  menuItem.action("");
}

describe("buildContextMenu", () => {
  it("runs the handler of the entry an item was built from, in submenus too", () => {
    const first = vi.fn();
    const nested = vi.fn();

    const menu = buildContextMenu([
      item("First", first),
      { kind: "separator" },
      { kind: "submenu", label: "More", entries: [item("Nested", nested)] },
    ]);

    expect(menu[1]).toEqual({ item: "Separator" });
    expect(menu[2]).toMatchObject({ text: "More" });
    select(menu[0]);
    select(
      "items" in menu[2] ? (menu[2].items?.[0] as ContextMenuItem) : undefined,
    );
    expect(first).toHaveBeenCalledOnce();
    expect(nested).toHaveBeenCalledOnce();
  });

  it("gives a disabled item no action", () => {
    const menu = buildContextMenu([
      { kind: "item", label: "Unavailable", enabled: false, onSelect: vi.fn() },
    ]);

    expect(menu).toEqual([{ text: "Unavailable", enabled: false }]);
  });

  it("shows an empty submenu as a disabled item", () => {
    const menu = buildContextMenu([
      { kind: "submenu", label: "Move to", entries: [] },
    ]);

    expect(menu).toEqual([{ text: "Move to", enabled: false }]);
  });

  it("reports a handler that throws instead of letting it escape", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const menu = buildContextMenu([
      item(
        "Broken",
        vi.fn(() => {
          throw new Error("handler bug");
        }),
      ),
    ]);

    expect(() => select(menu[0])).not.toThrow();
    expect(error).toHaveBeenCalled();
  });
});

describe("NativeContextMenu", () => {
  function stubMenus() {
    const menus: {
      popup: ReturnType<typeof vi.fn>;
      close: ReturnType<typeof vi.fn>;
    }[] = [];
    vi.mocked(Menu.new).mockImplementation(() => {
      const menu = {
        popup: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      };
      menus.push(menu);
      return Promise.resolve(menu as never);
    });
    return menus;
  }

  it("opens the menu at the pointer", async () => {
    const menus = stubMenus();

    new NativeContextMenu().show([item("Only")]);

    await vi.waitFor(() => expect(menus[0]?.popup).toHaveBeenCalled());
    expect(menus[0].popup).toHaveBeenCalledWith();
  });

  it("releases the previous menu when another is shown", async () => {
    const menus = stubMenus();
    const contextMenu = new NativeContextMenu();

    contextMenu.show([item("First")]);
    await vi.waitFor(() => expect(menus[0]?.popup).toHaveBeenCalled());
    contextMenu.show([item("Second")]);
    await vi.waitFor(() => expect(menus[1]?.popup).toHaveBeenCalled());

    expect(menus[0].close).toHaveBeenCalledOnce();
    expect(menus[1].close).not.toHaveBeenCalled();
  });

  it("reports a menu that cannot be shown", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(Menu.new).mockRejectedValue(new Error("no host"));

    new NativeContextMenu().show([item("Only")]);

    await vi.waitFor(() => expect(warn).toHaveBeenCalled());
  });
});
