import { afterEach, describe, expect, it, vi } from "vitest";
import type { ContextMenuEntry } from "./denoContextMenu.ts";
import { buildContextMenu, DenoContextMenu } from "./denoContextMenu.ts";

function item(label: string, onSelect = vi.fn()): ContextMenuEntry {
  return { kind: "item", label, enabled: true, onSelect };
}

describe("buildContextMenu", () => {
  it("numbers enabled items across submenus and maps ids to their handlers", () => {
    const first = vi.fn();
    const nested = vi.fn();

    const { menu, handlerById } = buildContextMenu([
      item("First", first),
      { kind: "separator" },
      { kind: "submenu", label: "More", entries: [item("Nested", nested)] },
    ], 3);

    expect(menu).toEqual([
      { item: { label: "First", id: "context:3:0", enabled: true } },
      "separator",
      {
        submenu: {
          label: "More",
          items: [
            { item: { label: "Nested", id: "context:3:1", enabled: true } },
          ],
        },
      },
    ]);
    expect(handlerById).toEqual(
      new Map([["context:3:0", first], ["context:3:1", nested]]),
    );
  });

  it("gives a disabled item no id", () => {
    const { menu, handlerById } = buildContextMenu([
      { kind: "item", label: "Unavailable", enabled: false, onSelect: vi.fn() },
    ], 1);

    expect(menu).toEqual([{ item: { label: "Unavailable", enabled: false } }]);
    expect(handlerById.size).toBe(0);
  });

  it("shows an empty submenu as a disabled item", () => {
    const { menu } = buildContextMenu([
      { kind: "submenu", label: "Move to", entries: [] },
    ], 1);

    expect(menu).toEqual([{ item: { label: "Move to", enabled: false } }]);
  });
});

describe("DenoContextMenu", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function stubBindings(clickIds: string[]) {
    const nextContextMenuClick = vi.fn<() => Promise<string>>();
    for (const id of clickIds) nextContextMenuClick.mockResolvedValueOnce(id);
    nextContextMenuClick.mockRejectedValue(new Error("loop stopped"));
    const showContextMenu = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("bindings", { showContextMenu, nextContextMenuClick });
    return { showContextMenu, nextContextMenuClick };
  }

  it("shows the built menu at the given position", () => {
    const { showContextMenu } = stubBindings([]);
    const contextMenu = new DenoContextMenu();

    contextMenu.show({ x: 12, y: 34 }, [item("Only")]);

    expect(showContextMenu).toHaveBeenCalledWith(12, 34, [
      { item: { label: "Only", id: "context:1:0", enabled: true } },
    ]);
  });

  it("dispatches a click to the handler of the menu shown last", async () => {
    const { nextContextMenuClick } = stubBindings(["context:2:0"]);
    const earlier = vi.fn();
    const latest = vi.fn();
    const contextMenu = new DenoContextMenu();
    contextMenu.show({ x: 0, y: 0 }, [item("Earlier", earlier)]);
    contextMenu.show({ x: 0, y: 0 }, [item("Latest", latest)]);

    contextMenu.start();
    await vi.waitFor(() =>
      expect(nextContextMenuClick).toHaveBeenCalledTimes(2)
    );

    expect(latest).toHaveBeenCalledTimes(1);
    expect(earlier).not.toHaveBeenCalled();
  });

  it("ignores a late click from a menu that has since been replaced", async () => {
    const { nextContextMenuClick } = stubBindings(["context:1:0"]);
    const earlier = vi.fn();
    const latest = vi.fn();
    const contextMenu = new DenoContextMenu();
    contextMenu.show({ x: 0, y: 0 }, [item("Earlier", earlier)]);
    contextMenu.show({ x: 0, y: 0 }, [item("Latest", latest)]);

    contextMenu.start();
    await vi.waitFor(() =>
      expect(nextContextMenuClick).toHaveBeenCalledTimes(2)
    );

    expect(earlier).not.toHaveBeenCalled();
    expect(latest).not.toHaveBeenCalled();
  });

  it("keeps delivering clicks after a handler throws", async () => {
    const { nextContextMenuClick } = stubBindings([
      "context:1:0",
      "context:1:1",
    ]);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const second = vi.fn();
    const contextMenu = new DenoContextMenu();
    contextMenu.show({ x: 0, y: 0 }, [
      item(
        "Broken",
        vi.fn(() => {
          throw new Error("handler bug");
        }),
      ),
      item("Second", second),
    ]);

    contextMenu.start();
    await vi.waitFor(() =>
      expect(nextContextMenuClick).toHaveBeenCalledTimes(3)
    );

    expect(second).toHaveBeenCalledTimes(1);
  });
});
