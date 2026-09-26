import { describe, expect, it } from "vitest";
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
    store.getState().cycleTableSort("priority");
    store.getState().setMode("table");
    store.getState().setMode("board");
    expect(store.getState().tableSort).toEqual({
      key: "priority",
      direction: "asc",
    });
  });
});
