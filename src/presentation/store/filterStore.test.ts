import { describe, expect, it } from "vitest";
import { createFilterStore } from "./filterStore.ts";

describe("createFilterStore", () => {
  it("starts with the sidebar collapsed", () => {
    const useFilterStore = createFilterStore();

    expect(useFilterStore.getState().isSidebarOpen).toBe(false);
  });

  it("sets, replaces, and clears the selected priority", () => {
    const useFilterStore = createFilterStore();

    useFilterStore.getState().setPriority("low");
    expect(useFilterStore.getState().criteria.priority).toBe("low");

    useFilterStore.getState().setPriority("high");
    expect(useFilterStore.getState().criteria.priority).toBe("high");

    useFilterStore.getState().setPriority(undefined);
    expect(useFilterStore.getState().criteria.priority).toBeUndefined();
  });

  it("clears the criteria without changing sidebar visibility", () => {
    const useFilterStore = createFilterStore();
    useFilterStore.getState().setPriority("medium");

    useFilterStore.getState().clear();

    expect(useFilterStore.getState().criteria).toEqual({});
    expect(useFilterStore.getState().isSidebarOpen).toBe(false);
  });

  it("toggles sidebar visibility", () => {
    const useFilterStore = createFilterStore();

    useFilterStore.getState().toggleSidebar();
    expect(useFilterStore.getState().isSidebarOpen).toBe(true);

    useFilterStore.getState().toggleSidebar();
    expect(useFilterStore.getState().isSidebarOpen).toBe(false);
  });
});
