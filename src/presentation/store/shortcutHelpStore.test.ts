import { describe, expect, it } from "vite-plus/test";
import { createShortcutHelpStore } from "./shortcutHelpStore.ts";

describe("createShortcutHelpStore", () => {
  it("starts closed and opens and closes independently of other instances", () => {
    const store = createShortcutHelpStore();
    const other = createShortcutHelpStore();
    expect(store.getState().isOpen).toBe(false);
    store.getState().open();
    expect(store.getState().isOpen).toBe(true);
    expect(other.getState().isOpen).toBe(false);
    store.getState().close();
    expect(store.getState().isOpen).toBe(false);
  });
});
