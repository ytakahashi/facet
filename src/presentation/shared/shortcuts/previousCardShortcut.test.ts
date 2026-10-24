import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import {
  canSwitchCardFrom,
  resolvePreviousCardShortcut,
} from "./previousCardShortcut.ts";

function shortcut(overrides: Partial<KeyboardEvent> = {}) {
  return resolvePreviousCardShortcut({
    key: "[",
    keyCode: 0,
    metaKey: true,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    isComposing: false,
    ...overrides,
  });
}

describe("resolvePreviousCardShortcut", () => {
  it("recognises Command-[", () => {
    expect(shortcut()).toBe(true);
  });
  it("rejects extra modifiers and events without Command", () => {
    expect(shortcut({ metaKey: false })).toBe(false);
    expect(shortcut({ ctrlKey: true })).toBe(false);
    expect(shortcut({ altKey: true })).toBe(false);
    expect(shortcut({ shiftKey: true })).toBe(false);
  });
  it.each(["]", "p", "Escape", ""])("leaves %s unclaimed", (key) => {
    expect(shortcut({ key })).toBe(false);
  });
  it("ignores active and completed IME composition keys", () => {
    expect(shortcut({ isComposing: true })).toBe(false);
    expect(shortcut({ keyCode: 229 })).toBe(false);
  });
});

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

function target(
  tagName: string,
  attributes: readonly string[] = [],
  parent?: FakeElement,
): EventTarget {
  return new FakeElement(tagName, attributes, parent) as unknown as EventTarget;
}

describe("canSwitchCardFrom", () => {
  beforeEach(() => {
    vi.stubGlobal("Element", FakeElement);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("allows targets outside text fields", () => {
    expect(canSwitchCardFrom(null)).toBe(true);
    expect(canSwitchCardFrom(target("div"))).toBe(true);
  });
  it("allows the Markdown editor", () => {
    expect(
      canSwitchCardFrom(target("textarea", ["data-markdown-editor"])),
    ).toBe(true);
  });
  it("keeps inline edits and other text fields in place", () => {
    expect(canSwitchCardFrom(target("input", [], new FakeElement("div")))).toBe(
      false,
    );
    expect(canSwitchCardFrom(target("textarea"))).toBe(false);
    expect(
      canSwitchCardFrom(
        target("span", [], new FakeElement("div", ["contenteditable"])),
      ),
    ).toBe(false);
  });
});
