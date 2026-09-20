import { describe, expect, it } from "vitest";
import { resolveEditorShortcut } from "./editorShortcut.ts";

function shortcut(
  overrides: Partial<KeyboardEvent> & Pick<KeyboardEvent, "key">,
) {
  return resolveEditorShortcut({
    metaKey: true,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    isComposing: false,
    ...overrides,
  });
}

describe("resolveEditorShortcut", () => {
  it("recognises Command-K with either letter case", () => {
    expect(shortcut({ key: "k" })).toBe("insert-link");
    expect(shortcut({ key: "K" })).toBe("insert-link");
  });

  it("rejects other modifiers and keys", () => {
    expect(shortcut({ key: "k", metaKey: false })).toBeUndefined();
    expect(shortcut({ key: "k", ctrlKey: true })).toBeUndefined();
    expect(shortcut({ key: "k", altKey: true })).toBeUndefined();
    expect(shortcut({ key: "k", shiftKey: true })).toBeUndefined();
    expect(shortcut({ key: "p" })).toBeUndefined();
  });

  it("ignores the shortcut while an IME is composing", () => {
    expect(shortcut({ key: "k", isComposing: true })).toBeUndefined();
  });
});
