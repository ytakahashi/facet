export type ShortcutId =
  | "switch-tab"
  | "show-help"
  | "search-titles"
  | "search-contents"
  | "toggle-filters"
  | "close-viewer"
  | "previous-card"
  | "toggle-mode"
  | "save"
  | "find"
  | "next-match"
  | "previous-match"
  | "close-find"
  | "insert-link"
  | "indent"
  | "outdent"
  | "move-selection"
  | "confirm"
  | "cancel-rename";

export interface KeyCombo {
  key: string;
  shift?: boolean;
  command?: boolean;
  label?: string;
  // Where the combination works when narrower than its group, shown after the
  // keys. Kept apart from `label` so the keys themselves stay data.
  context?: string;
}

export interface ShortcutEntry {
  id: ShortcutId;
  description: string;
  combos: readonly KeyCombo[];
}

export interface ShortcutGroup {
  title: string;
  entries: readonly ShortcutEntry[];
}

export const shortcutGroups: readonly ShortcutGroup[] = [
  {
    title: "General",
    entries: [
      {
        id: "switch-tab",
        description: "Switch to board tab",
        combos: [{ key: "1", command: true, label: "1–9" }],
      },
      {
        id: "show-help",
        description: "Show keyboard shortcuts",
        combos: [{ key: "?" }],
      },
    ],
  },
  {
    title: "Board",
    entries: [
      {
        id: "previous-card",
        description: "Switch to previous card",
        combos: [{ key: "[", command: true }],
      },
      {
        id: "search-titles",
        description: "Search card titles",
        combos: [{ key: "p", command: true }],
      },
      {
        id: "search-contents",
        description: "Search card contents",
        combos: [{ key: "f", shift: true, command: true }],
      },
      {
        id: "toggle-filters",
        description: "Toggle filters",
        combos: [{ key: "b", command: true }],
      },
    ],
  },
  {
    title: "Card viewer",
    entries: [
      {
        id: "close-viewer",
        description: "Close viewer",
        combos: [{ key: "Escape" }],
      },
      {
        id: "toggle-mode",
        description: "Toggle edit / preview",
        combos: [{ key: "e", command: true }],
      },
      {
        id: "save",
        description: "Save",
        combos: [{ key: "s", command: true }],
      },
    ],
  },
  {
    title: "Find in card",
    entries: [
      {
        id: "find",
        description: "Find",
        combos: [{ key: "f", command: true }],
      },
      {
        id: "next-match",
        description: "Next match",
        combos: [
          { key: "g", command: true },
          { key: "Enter", context: "in find field" },
        ],
      },
      {
        id: "previous-match",
        description: "Previous match",
        combos: [
          { key: "g", shift: true, command: true },
          { key: "Enter", shift: true, context: "in find field" },
        ],
      },
      {
        id: "close-find",
        description: "Close find",
        combos: [{ key: "Escape" }],
      },
    ],
  },
  {
    title: "Editor",
    entries: [
      {
        id: "insert-link",
        description: "Insert card link",
        combos: [{ key: "k", command: true }],
      },
      {
        id: "indent",
        description: "Indent",
        combos: [{ key: "Tab" }],
      },
      {
        id: "outdent",
        description: "Outdent",
        combos: [{ key: "Tab", shift: true }],
      },
    ],
  },
  {
    title: "Lists & editing",
    entries: [
      {
        id: "move-selection",
        description: "Move selection",
        combos: [{ key: "ArrowUp" }, { key: "ArrowDown" }],
      },
      {
        id: "confirm",
        description: "Open / confirm",
        combos: [{ key: "Enter" }],
      },
      {
        id: "cancel-rename",
        description: "Cancel rename",
        combos: [{ key: "Escape" }],
      },
    ],
  },
];

const keySymbols: Readonly<Record<string, string>> = {
  Escape: "⎋",
  Tab: "⇥",
  Enter: "↩",
  ArrowUp: "↑",
  ArrowDown: "↓",
};

export function formatKeyCombo(combo: KeyCombo): string[] {
  return [
    ...(combo.shift ? ["⇧"] : []),
    ...(combo.command ? ["⌘"] : []),
    combo.label ?? keySymbols[combo.key] ?? combo.key.toUpperCase(),
  ];
}
