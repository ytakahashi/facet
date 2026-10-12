import { describe, expect, it } from "vitest";
import { resolveFilterSidebarShortcut } from "./filterSidebarShortcut.ts";

function shortcut(overrides: Partial<KeyboardEvent> = {}) {
  return resolveFilterSidebarShortcut({
    key: "b",
    keyCode: 0,
    isComposing: false,
    metaKey: true,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    ...overrides,
  });
}

describe("resolveFilterSidebarShortcut", () => {
  it("recognises Command-B with either letter case", () => {
    expect(shortcut({ key: "b" })).toBe(true);
    expect(shortcut({ key: "B" })).toBe(true);
  });
  it("requires Command and rejects Control, Option, and Shift", () => {
    expect(shortcut({ metaKey: false })).toBe(false);
    expect(shortcut({ ctrlKey: true })).toBe(false);
    expect(shortcut({ altKey: true })).toBe(false);
    expect(shortcut({ shiftKey: true })).toBe(false);
  });
  it.each(["p", "k", "Escape", ""])("leaves Command-%s unclaimed", (key) => {
    expect(shortcut({ key })).toBe(false);
  });
  it("ignores active and completed IME composition keys", () => {
    expect(shortcut({ isComposing: true })).toBe(false);
    expect(shortcut({ keyCode: 229 })).toBe(false);
  });
});
