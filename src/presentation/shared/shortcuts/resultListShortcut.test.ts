import { describe, expect, it } from "vite-plus/test";
import { resolveResultListShortcut } from "./resultListShortcut.ts";

function shortcut(key: string, overrides: Partial<KeyboardEvent> = {}) {
  return resolveResultListShortcut({
    key,
    keyCode: 0,
    isComposing: false,
    ...overrides,
  });
}

describe("resolveResultListShortcut", () => {
  it("resolves the arrow keys and Enter", () => {
    expect(shortcut("ArrowDown")).toBe("next");
    expect(shortcut("ArrowUp")).toBe("previous");
    expect(shortcut("Enter")).toBe("confirm");
  });
  it("leaves other keys to the input", () => {
    expect(shortcut("a")).toBeUndefined();
    expect(shortcut("Escape")).toBeUndefined();
  });
  it("does not act on keys consumed by IME", () => {
    for (const key of ["Enter", "ArrowDown", "ArrowUp"]) {
      expect(shortcut(key, { isComposing: true })).toBeUndefined();
      expect(shortcut(key, { keyCode: 229 })).toBeUndefined();
    }
  });
});
