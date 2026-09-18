import { describe, expect, it } from "vitest";
import { resolveBoardSearchShortcut } from "./boardSearchShortcut.ts";

function shortcut(
  overrides: Partial<KeyboardEvent> & Pick<KeyboardEvent, "key">,
) {
  return resolveBoardSearchShortcut({
    metaKey: true,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    ...overrides,
  });
}

describe("resolveBoardSearchShortcut", () => {
  it("recognises title search with either letter case", () => {
    expect(shortcut({ key: "p" })).toBe("title");
    expect(shortcut({ key: "P" })).toBe("title");
  });

  it("recognises content search with Shift and either letter case", () => {
    expect(shortcut({ key: "f", shiftKey: true })).toBe("content");
    expect(shortcut({ key: "F", shiftKey: true })).toBe("content");
  });

  it("leaves other Command combinations unclaimed", () => {
    expect(shortcut({ key: "p", shiftKey: true })).toBeUndefined();
    expect(shortcut({ key: "f" })).toBeUndefined();
    expect(shortcut({ key: "k" })).toBeUndefined();
  });

  it("rejects shortcuts without Command or with Control or Option", () => {
    expect(shortcut({ key: "p", metaKey: false })).toBeUndefined();
    expect(shortcut({ key: "p", ctrlKey: true })).toBeUndefined();
    expect(shortcut({ key: "F", shiftKey: true, altKey: true }))
      .toBeUndefined();
  });
});
