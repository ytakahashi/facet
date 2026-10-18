import { describe, expect, it } from "vite-plus/test";
import { createBoardViewStore } from "./boardViewStore.ts";

describe("createBoardViewStore", () => {
  it("starts in Board view with board order", () => {
    const store = createBoardViewStore();
    expect(store.getState().mode).toBe("board");
    expect(store.getState().tableSort).toBeUndefined();
  });

  it("cycles a key and starts a different key ascending", () => {
    const store = createBoardViewStore();
    store.getState().cycleTableSort("title");
    expect(store.getState().tableSort).toEqual({
      key: "title",
      direction: "asc",
    });
    store.getState().cycleTableSort("title");
    expect(store.getState().tableSort).toEqual({
      key: "title",
      direction: "desc",
    });
    store.getState().cycleTableSort("title");
    expect(store.getState().tableSort).toBeUndefined();
    store.getState().cycleTableSort("path");
    expect(store.getState().tableSort).toEqual({
      key: "path",
      direction: "asc",
    });
    store.getState().cycleTableSort("title");
    expect(store.getState().tableSort).toEqual({
      key: "title",
      direction: "asc",
    });
  });

  it("retains sorting when switching views", () => {
    const store = createBoardViewStore();
    store.getState().cycleTableSort("path");
    store.getState().setMode("table");
    store.getState().setMode("board");
    expect(store.getState().tableSort).toEqual({
      key: "path",
      direction: "asc",
    });
  });
});

describe("directory state", () => {
  it("toggles without mutating prior state and retains state across view switches", () => {
    const store = createBoardViewStore();
    const initial = store.getState().collapsedDirectories;
    store.getState().toggleDirectory("docs");
    expect(initial.size).toBe(0);
    expect(store.getState().collapsedDirectories.has("docs")).toBe(true);
    store.getState().setMode("directory");
    store.getState().setMode("table");
    store.getState().setMode("directory");
    expect(store.getState().collapsedDirectories.has("docs")).toBe(true);
    expect(store.getState().collapsedDirectories.has("new-directory")).toBe(
      false,
    );
    store.getState().toggleDirectory("docs");
    expect(store.getState().collapsedDirectories.size).toBe(0);
  });

  it("isolates the mode and collapsed directories between sessions", () => {
    const first = createBoardViewStore();
    const second = createBoardViewStore();
    first.getState().toggleDirectory("docs");
    first.getState().setMode("directory");
    expect(second.getState().collapsedDirectories.size).toBe(0);
    expect(second.getState().mode).toBe("board");
  });
});
