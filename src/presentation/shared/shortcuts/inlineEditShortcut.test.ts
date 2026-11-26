import { describe, expect, it } from "vite-plus/test";
import { resolveInlineEditShortcut } from "./inlineEditShortcut.ts";

function shortcut(key: string, overrides: Partial<KeyboardEvent> = {}) {
  return resolveInlineEditShortcut({
    key,
    keyCode: 0,
    isComposing: false,
    ...overrides,
  });
}

describe("resolveInlineEditShortcut", () => {
  it("resolves Enter and Escape", () => {
    expect(shortcut("Enter")).toBe("commit");
    expect(shortcut("Escape")).toBe("cancel");
  });
  it("leaves other keys to the input", () => {
    expect(shortcut("a")).toBeUndefined();
    expect(shortcut("ArrowDown")).toBeUndefined();
  });
  it("does not act on keys consumed by IME", () => {
    for (const key of ["Enter", "Escape"]) {
      expect(shortcut(key, { isComposing: true })).toBeUndefined();
      expect(shortcut(key, { keyCode: 229 })).toBeUndefined();
    }
  });
});
