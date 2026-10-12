import { describe, expect, it } from "vitest";
import { resolveHelpShortcut } from "./helpShortcut.ts";

function shortcut(overrides: Partial<KeyboardEvent> = {}) {
  return resolveHelpShortcut({
    key: "?",
    keyCode: 0,
    isComposing: false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    ...overrides,
  });
}

describe("resolveHelpShortcut", () => {
  it("recognises the question mark with or without Shift", () => {
    expect(shortcut({ shiftKey: true })).toBe(true);
    expect(shortcut({ shiftKey: false })).toBe(true);
  });
  it("rejects Command, Control, and Option", () => {
    expect(shortcut({ metaKey: true })).toBe(false);
    expect(shortcut({ ctrlKey: true })).toBe(false);
    expect(shortcut({ altKey: true })).toBe(false);
  });
  it.each(["/", "h", "Escape", ""])("leaves %s unclaimed", (key) => {
    expect(shortcut({ key })).toBe(false);
  });
  it("ignores active and completed IME composition keys", () => {
    expect(shortcut({ isComposing: true })).toBe(false);
    expect(shortcut({ keyCode: 229 })).toBe(false);
  });
});
