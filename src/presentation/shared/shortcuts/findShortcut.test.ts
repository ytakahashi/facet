import { describe, expect, it } from "vitest";
import { resolveFindShortcut } from "./findShortcut.ts";

function shortcut(key: string, overrides: Partial<KeyboardEvent> = {}) {
  return resolveFindShortcut({
    key,
    keyCode: 0,
    isComposing: false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    ...overrides,
  });
}

describe("resolveFindShortcut", () => {
  it("resolves Enter, Shift-Enter, and bare Escape", () => {
    expect(shortcut("Enter")).toBe("next");
    expect(shortcut("Enter", { shiftKey: true })).toBe("previous");
    expect(shortcut("Escape")).toBe("close");
    expect(shortcut("Escape", { shiftKey: true })).toBeUndefined();
  });
  it("leaves modified Enter and Viewer shortcuts to their owners", () => {
    expect(shortcut("Enter", { metaKey: true })).toBeUndefined();
    expect(shortcut("Enter", { ctrlKey: true })).toBeUndefined();
    expect(shortcut("Enter", { altKey: true })).toBeUndefined();
    expect(shortcut("g", { metaKey: true })).toBeUndefined();
  });
  it("does not act on keys consumed by IME", () => {
    for (const key of ["Enter", "Escape"]) {
      expect(shortcut(key, { isComposing: true })).toBeUndefined();
      expect(shortcut(key, { keyCode: 229 })).toBeUndefined();
    }
  });
});
