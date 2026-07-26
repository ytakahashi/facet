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
    useFilterStore.getState().toggleLabel("bug");
    useFilterStore.getState().toggleColumnVisibility("done");

    useFilterStore.getState().clear();

    expect(useFilterStore.getState().criteria).toEqual({
      labels: new Set(),
      hiddenColumnIds: new Set(),
    });
    expect(useFilterStore.getState().isSidebarOpen).toBe(false);
  });

  it("toggles sidebar visibility", () => {
    const useFilterStore = createFilterStore();

    useFilterStore.getState().toggleSidebar();
    expect(useFilterStore.getState().isSidebarOpen).toBe(true);

    useFilterStore.getState().toggleSidebar();
    expect(useFilterStore.getState().isSidebarOpen).toBe(false);
  });

  it("toggles label selection on and off", () => {
    const useFilterStore = createFilterStore();

    useFilterStore.getState().toggleLabel("bug");
    useFilterStore.getState().toggleLabel("urgent");
    expect(useFilterStore.getState().criteria.labels).toEqual(
      new Set(["bug", "urgent"]),
    );

    useFilterStore.getState().toggleLabel("bug");
    expect(useFilterStore.getState().criteria.labels).toEqual(
      new Set(["urgent"]),
    );
  });

  it("hides and shows a column again", () => {
    const useFilterStore = createFilterStore();

    useFilterStore.getState().toggleColumnVisibility("done");
    useFilterStore.getState().toggleColumnVisibility("ideas");
    expect(useFilterStore.getState().criteria.hiddenColumnIds).toEqual(
      new Set(["done", "ideas"]),
    );

    useFilterStore.getState().toggleColumnVisibility("done");
    expect(useFilterStore.getState().criteria.hiddenColumnIds).toEqual(
      new Set(["ideas"]),
    );
  });

  it("keeps the label and priority selection when a column is hidden", () => {
    const useFilterStore = createFilterStore();
    useFilterStore.getState().setPriority("high");
    useFilterStore.getState().toggleLabel("bug");

    useFilterStore.getState().toggleColumnVisibility("done");

    expect(useFilterStore.getState().criteria).toEqual({
      labels: new Set(["bug"]),
      priority: "high",
      hiddenColumnIds: new Set(["done"]),
    });
  });

  it("rebuilds label selection from empty after clear", () => {
    const useFilterStore = createFilterStore();
    useFilterStore.getState().toggleLabel("bug");
    useFilterStore.getState().clear();

    useFilterStore.getState().toggleLabel("urgent");

    expect(useFilterStore.getState().criteria.labels).toEqual(
      new Set(["urgent"]),
    );
  });

  it("drops a selected label once it is deleted from the registry", () => {
    const useFilterStore = createFilterStore();
    useFilterStore.getState().toggleLabel("bug");
    useFilterStore.getState().toggleLabel("urgent");

    // "bug" removed from the board's label registry; "urgent" still exists.
    useFilterStore.getState().syncLabels(new Set(["urgent"]));

    expect(useFilterStore.getState().criteria.labels).toEqual(
      new Set(["urgent"]),
    );
  });

  it("drops a selected label once it is renamed away, without selecting the new name", () => {
    const useFilterStore = createFilterStore();
    useFilterStore.getState().toggleLabel("bug");

    // "bug" renamed to "defect": the registry no longer contains "bug", and
    // nothing ever selected "defect".
    useFilterStore.getState().syncLabels(new Set(["defect"]));

    expect(useFilterStore.getState().criteria.labels).toEqual(new Set());
  });

  it("clears the selection entirely once the registry becomes empty", () => {
    const useFilterStore = createFilterStore();
    useFilterStore.getState().toggleLabel("bug");

    useFilterStore.getState().syncLabels(new Set());

    expect(useFilterStore.getState().criteria.labels).toEqual(new Set());
  });

  it("leaves selection and priority untouched when every selected label is still valid", () => {
    const useFilterStore = createFilterStore();
    useFilterStore.getState().setPriority("high");
    useFilterStore.getState().toggleLabel("bug");
    useFilterStore.getState().toggleColumnVisibility("done");

    useFilterStore.getState().syncLabels(new Set(["bug", "urgent"]));

    expect(useFilterStore.getState().criteria).toEqual({
      labels: new Set(["bug"]),
      priority: "high",
      hiddenColumnIds: new Set(["done"]),
    });
  });
});
