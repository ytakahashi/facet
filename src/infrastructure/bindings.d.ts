import type { MenuItem } from "./denoMenuItem.ts";

// What is left of the Deno Desktop bindings: the native menus, which the view
// still asks the Deno host for. File-system and Finder access go through
// hostCommands.ts. Under Tauri this global does not exist, so these calls
// fail and the menus simply do not appear.
export interface Bindings {
  setApplicationMenu(menu: MenuItem[]): Promise<void>;
  nextMenuClick(): Promise<string>;
  showContextMenu(x: number, y: number, menu: MenuItem[]): Promise<void>;
  nextContextMenuClick(): Promise<string>;
}

declare global {
  const bindings: Bindings;
}
