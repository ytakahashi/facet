import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { resolveCardMoveShortcut } from "./cardMoveShortcut.ts";

// Tests run without a DOM. This stands in for Element with just enough of
// closest() to match tag names and attribute presence up the parent chain.
class FakeElement {
  readonly tagName: string;
  readonly attributes: readonly string[];
  readonly parent: FakeElement | undefined;

  constructor(
    tagName: string,
    attributes: readonly string[] = [],
    parent?: FakeElement,
  ) {
    this.tagName = tagName;
    this.attributes = attributes;
    this.parent = parent;
  }

  closest(selectors: string): FakeElement | null {
    const matches = selectors
      .split(",")
      .map((selector) => selector.trim())
      .some((selector) =>
        selector.startsWith("[")
          ? this.attributes.includes(selector.slice(1, -1))
          : this.tagName === selector,
      );
    if (matches) return this;
    return this.parent?.closest(selectors) ?? null;
  }
}

function shortcut(overrides: Partial<KeyboardEvent> = {}) {
  return resolveCardMoveShortcut({
    key: "ArrowUp",
    keyCode: 0,
    metaKey: false,
    ctrlKey: false,
    altKey: true,
    shiftKey: false,
    isComposing: false,
    target: null,
    ...overrides,
  });
}

describe("resolveCardMoveShortcut", () => {
  beforeEach(() => {
    vi.stubGlobal("Element", FakeElement);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("recognises Option-Up and Option-Down", () => {
    expect(shortcut()).toBe("up");
    expect(shortcut({ key: "ArrowDown" })).toBe("down");
  });
  it("rejects extra modifiers and arrows without Option", () => {
    expect(shortcut({ altKey: false })).toBeUndefined();
    expect(shortcut({ metaKey: true })).toBeUndefined();
    expect(shortcut({ ctrlKey: true })).toBeUndefined();
    expect(shortcut({ shiftKey: true })).toBeUndefined();
  });
  it.each(["ArrowLeft", "ArrowRight", "Enter", ""])(
    "leaves Option-%s unclaimed",
    (key) => {
      expect(shortcut({ key })).toBeUndefined();
    },
  );
  it("ignores active and completed IME composition keys", () => {
    expect(shortcut({ isComposing: true })).toBeUndefined();
    expect(shortcut({ keyCode: 229 })).toBeUndefined();
  });
  it("leaves text fields, including the Markdown editor, to move the caret", () => {
    const fields = [
      new FakeElement("input"),
      new FakeElement("textarea", ["data-markdown-editor"]),
      new FakeElement("span", [], new FakeElement("div", ["contenteditable"])),
    ];
    for (const field of fields) {
      expect(
        shortcut({ target: field as unknown as EventTarget }),
      ).toBeUndefined();
    }
  });
  it("allows targets outside text fields", () => {
    const button = new FakeElement("button", [], new FakeElement("div"));
    expect(shortcut({ target: button as unknown as EventTarget })).toBe("up");
  });
});
