// Mirrors the JSON shape Deno Desktop's win.setApplicationMenu and
// win.showContextMenu expect.
// Kept local to this file (not imported from a Deno types package) since the
// desktop host treats the menu as an opaque pass-through value.
// `enabled` is required on the "item" variant - omitting it made Deno
// Desktop silently drop the entire containing top-level menu on-device
// (confirmed: a File menu with one enabled-less item disappeared while
// sibling menus rendered fine), so it's typed as required here to prevent
// that mistake from recurring.
export type MenuItem =
  | { item: { label: string; id?: string; enabled: boolean } }
  | { submenu: { label: string; items: MenuItem[] } }
  | { role: { role: string } }
  | "separator";
