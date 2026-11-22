export type ContextMenuEntry =
  | { kind: "item"; label: string; enabled: boolean; onSelect: () => void }
  | { kind: "submenu"; label: string; entries: readonly ContextMenuEntry[] }
  | { kind: "separator" }
  | { kind: "copy" };

export interface ContextMenuPosition {
  x: number;
  y: number;
}

export interface ContextMenu {
  // The position is relative to the webview viewport. Omitting it uses the pointer.
  show(entries: readonly ContextMenuEntry[], at?: ContextMenuPosition): void;
}
