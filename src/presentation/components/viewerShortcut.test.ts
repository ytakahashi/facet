import { describe, expect, it } from "vitest";
import { resolveViewerShortcut } from "./viewerShortcut.ts";

function shortcut(
  overrides: Partial<KeyboardEvent> & Pick<KeyboardEvent, "key">,
) {
  return resolveViewerShortcut({
    metaKey: true,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    isComposing: false,
    ...overrides,
  });
}

describe("resolveViewerShortcut", () => {
  it("recognises Command-[ as back", () => {
    expect(shortcut({ key: "[" })).toBe("back");
  });

  it("leaves other Command combinations unclaimed", () => {
    expect(shortcut({ key: "]" })).toBeUndefined();
    expect(shortcut({ key: "p" })).toBeUndefined();
  });

  it("rejects extra modifiers and events without Command", () => {
    expect(shortcut({ key: "[", metaKey: false })).toBeUndefined();
    expect(shortcut({ key: "[", ctrlKey: true })).toBeUndefined();
    expect(shortcut({ key: "[", altKey: true })).toBeUndefined();
    expect(shortcut({ key: "[", shiftKey: true })).toBeUndefined();
  });

  it("ignores the shortcut while an IME composition is active", () => {
    expect(shortcut({ key: "[", isComposing: true })).toBeUndefined();
  });
});
