import { describe, expect, it } from "vitest";
import { resolveViewerShortcut } from "./viewerShortcut.ts";

function shortcut(
  overrides: Partial<KeyboardEvent> & Pick<KeyboardEvent, "key">,
) {
  return resolveViewerShortcut({
    keyCode: 0,
    metaKey: true,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    isComposing: false,
    ...overrides,
  });
}

function escape(overrides: Partial<KeyboardEvent> = {}) {
  return shortcut({ key: "Escape", metaKey: false, ...overrides });
}

describe("resolveViewerShortcut", () => {
  it("recognises find without claiming the board content-search shortcut", () => {
    expect(shortcut({ key: "f" })).toBe("find");
    expect(shortcut({ key: "F" })).toBe("find");
    expect(shortcut({ key: "F", shiftKey: true })).toBeUndefined();
  });

  it("recognises next and previous find with either letter case", () => {
    expect(shortcut({ key: "g" })).toBe("find-next");
    expect(shortcut({ key: "G" })).toBe("find-next");
    expect(shortcut({ key: "g", shiftKey: true })).toBe("find-previous");
    expect(shortcut({ key: "G", shiftKey: true })).toBe("find-previous");
  });

  it("rejects invalid modifiers and IME-consumed find keys", () => {
    for (const key of ["f", "g"]) {
      expect(shortcut({ key, metaKey: false })).toBeUndefined();
      expect(shortcut({ key, ctrlKey: true })).toBeUndefined();
      expect(shortcut({ key, altKey: true })).toBeUndefined();
      expect(shortcut({ key, isComposing: true })).toBeUndefined();
      expect(shortcut({ key, keyCode: 229 })).toBeUndefined();
    }
  });
  it("recognises Command-[ as back", () => {
    expect(shortcut({ key: "[" })).toBe("back");
  });

  it("recognises Command-S as save with either letter case", () => {
    expect(shortcut({ key: "s" })).toBe("save");
    expect(shortcut({ key: "S" })).toBe("save");
  });

  it("recognises Command-E as toggle-mode with either letter case", () => {
    expect(shortcut({ key: "e" })).toBe("toggle-mode");
    expect(shortcut({ key: "E" })).toBe("toggle-mode");
  });

  it("recognises a bare Escape as close", () => {
    expect(escape()).toBe("close");
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
    expect(shortcut({ key: "s", metaKey: false })).toBeUndefined();
    expect(shortcut({ key: "s", ctrlKey: true })).toBeUndefined();
    expect(shortcut({ key: "s", altKey: true })).toBeUndefined();
    expect(shortcut({ key: "s", shiftKey: true })).toBeUndefined();
    expect(shortcut({ key: "e", metaKey: false })).toBeUndefined();
    expect(shortcut({ key: "e", ctrlKey: true })).toBeUndefined();
    expect(shortcut({ key: "e", altKey: true })).toBeUndefined();
    expect(shortcut({ key: "e", shiftKey: true })).toBeUndefined();
  });

  it("rejects Escape with any modifier", () => {
    expect(escape({ metaKey: true })).toBeUndefined();
    expect(escape({ ctrlKey: true })).toBeUndefined();
    expect(escape({ altKey: true })).toBeUndefined();
    expect(escape({ shiftKey: true })).toBeUndefined();
  });

  it("ignores the shortcut while an IME composition is active", () => {
    expect(shortcut({ key: "[", isComposing: true })).toBeUndefined();
    expect(shortcut({ key: "s", isComposing: true })).toBeUndefined();
    expect(shortcut({ key: "e", isComposing: true })).toBeUndefined();
    expect(escape({ isComposing: true })).toBeUndefined();
  });

  it("ignores a key the IME consumed after composition has ended", () => {
    expect(escape({ keyCode: 229 })).toBeUndefined();
    expect(shortcut({ key: "s", keyCode: 229 })).toBeUndefined();
  });
});
