import { describe, expect, it } from "vitest";
import { resolveTabShortcut } from "./tabShortcut.ts";

function shortcut(
  overrides: Partial<KeyboardEvent> & Pick<KeyboardEvent, "key">,
) {
  return resolveTabShortcut({
    keyCode: 0,
    metaKey: true,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    isComposing: false,
    ...overrides,
  });
}

describe("resolveTabShortcut", () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8])(
    "maps Command-%i to its zero-based tab position",
    (number) => {
      expect(shortcut({ key: String(number) })).toBe(number - 1);
    },
  );

  it("maps Command-9 to the ninth position, not a last-tab sentinel", () => {
    expect(shortcut({ key: "9" })).toBe(8);
  });

  it.each(["0", "10", "", "p", "ArrowRight", "!", "１"])(
    "leaves Command-%s unclaimed",
    (key) => {
      expect(shortcut({ key })).toBeUndefined();
    },
  );

  it("rejects extra modifiers and events without Command", () => {
    expect(shortcut({ key: "1", metaKey: false })).toBeUndefined();
    expect(shortcut({ key: "1", ctrlKey: true })).toBeUndefined();
    expect(shortcut({ key: "1", altKey: true })).toBeUndefined();
    expect(shortcut({ key: "1", shiftKey: true })).toBeUndefined();
  });

  it("ignores the shortcut while an IME composition is active", () => {
    expect(shortcut({ key: "1", isComposing: true })).toBeUndefined();
  });

  it("ignores a key the IME consumed after composition has ended", () => {
    expect(shortcut({ key: "1", keyCode: 229 })).toBeUndefined();
  });
});
