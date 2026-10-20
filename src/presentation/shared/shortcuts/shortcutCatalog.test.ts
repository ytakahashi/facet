import { describe, expect, it } from "vite-plus/test";
import { resolveBoardSearchShortcut } from "./boardSearchShortcut.ts";
import { resolveEditorShortcut } from "./editorShortcut.ts";
import { resolveFilterSidebarShortcut } from "./filterSidebarShortcut.ts";
import { resolveFindShortcut } from "./findShortcut.ts";
import { resolveHelpShortcut } from "./helpShortcut.ts";
import { formatKeyCombo, shortcutGroups } from "./shortcutCatalog.ts";
import type { KeyCombo, ShortcutId } from "./shortcutCatalog.ts";
import { resolveTabShortcut } from "./tabShortcut.ts";
import { resolveViewerShortcut } from "./viewerShortcut.ts";

function eventFor(combo: KeyCombo) {
  return {
    key: combo.key,
    shiftKey: combo.shift ?? false,
    metaKey: combo.command ?? false,
    ctrlKey: false,
    altKey: false,
    keyCode: 0,
    isComposing: false,
  };
}

type ShortcutEvent = ReturnType<typeof eventFor>;
type Expectation =
  | "handled-inline"
  | {
      resolve: (event: ShortcutEvent) => unknown;
      result: string | number | boolean;
    };

const expectations: Record<ShortcutId, readonly Expectation[]> = {
  "switch-tab": [{ resolve: resolveTabShortcut, result: 0 }],
  "show-help": [{ resolve: resolveHelpShortcut, result: true }],
  "search-titles": [{ resolve: resolveBoardSearchShortcut, result: "title" }],
  "search-contents": [
    {
      resolve: resolveBoardSearchShortcut,
      result: "content",
    },
  ],
  "toggle-filters": [{ resolve: resolveFilterSidebarShortcut, result: true }],
  "close-viewer": [{ resolve: resolveViewerShortcut, result: "close" }],
  "go-back": [{ resolve: resolveViewerShortcut, result: "back" }],
  "toggle-mode": [{ resolve: resolveViewerShortcut, result: "toggle-mode" }],
  save: [{ resolve: resolveViewerShortcut, result: "save" }],
  find: [{ resolve: resolveViewerShortcut, result: "find" }],
  "next-match": [
    { resolve: resolveViewerShortcut, result: "find-next" },
    { resolve: resolveFindShortcut, result: "next" },
  ],
  "previous-match": [
    { resolve: resolveViewerShortcut, result: "find-previous" },
    { resolve: resolveFindShortcut, result: "previous" },
  ],
  "close-find": [{ resolve: resolveFindShortcut, result: "close" }],
  "insert-link": [{ resolve: resolveEditorShortcut, result: "insert-link" }],
  indent: [{ resolve: resolveEditorShortcut, result: "indent" }],
  outdent: [{ resolve: resolveEditorShortcut, result: "outdent" }],
  "move-selection": ["handled-inline", "handled-inline"],
  confirm: ["handled-inline"],
  "cancel-rename": ["handled-inline"],
};

const entries = shortcutGroups.flatMap((group) => group.entries);

describe("shortcutGroups", () => {
  it("has unique IDs matching the complete expectation table", () => {
    const ids = entries.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(Object.keys(expectations).sort());
  });
  it.each(entries)("matches the resolver for $id", (entry) => {
    const expected = expectations[entry.id];
    expect(entry.combos.length).toBeGreaterThan(0);
    expect(expected).toHaveLength(entry.combos.length);
    entry.combos.forEach((combo, index) => {
      const expectation = expected[index];
      if (expectation === "handled-inline") return;
      expect(expectation.resolve(eventFor(combo))).toBe(expectation.result);
    });
  });
});

describe("formatKeyCombo", () => {
  it("orders Shift before Command and uppercases letters", () => {
    expect(formatKeyCombo({ key: "f", shift: true, command: true })).toEqual([
      "⇧",
      "⌘",
      "F",
    ]);
  });
  it.each([
    ["Escape", "⎋"],
    ["Enter", "↩"],
    ["Tab", "⇥"],
    ["ArrowUp", "↑"],
    ["ArrowDown", "↓"],
    ["[", "["],
    ["?", "?"],
  ])("formats %s as %s", (key, symbol) => {
    expect(formatKeyCombo({ key })).toEqual([symbol]);
  });
  it("leaves context out of the keys", () => {
    expect(formatKeyCombo({ key: "Enter", context: "in find field" })).toEqual([
      "↩",
    ]);
  });
  it("uses a label only for the key, leaving modifiers intact", () => {
    expect(formatKeyCombo({ key: "1", command: true, label: "1–9" })).toEqual([
      "⌘",
      "1–9",
    ]);
  });
});
