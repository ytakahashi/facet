import { describe, expect, it } from "vitest";
import {
  clampSelectionIndex,
  nextSelectionIndex,
} from "./cardSearchSelection.ts";

describe("nextSelectionIndex", () => {
  it("steps through the list in both directions", () => {
    expect(nextSelectionIndex(0, 3, 1)).toBe(1);
    expect(nextSelectionIndex(2, 3, -1)).toBe(1);
  });

  it("wraps around at both ends", () => {
    expect(nextSelectionIndex(2, 3, 1)).toBe(0);
    expect(nextSelectionIndex(0, 3, -1)).toBe(2);
  });

  it("stays at 0 for an empty list", () => {
    expect(nextSelectionIndex(0, 0, 1)).toBe(0);
    expect(nextSelectionIndex(0, 0, -1)).toBe(0);
  });
});

describe("clampSelectionIndex", () => {
  it("keeps an index the list still has", () => {
    const result = clampSelectionIndex(1, 3);

    expect(result).toBe(1);
  });

  it("pulls an index past the end back to the last entry", () => {
    const result = clampSelectionIndex(5, 3);

    expect(result).toBe(2);
  });

  it("returns 0 for an empty list", () => {
    const result = clampSelectionIndex(2, 0);

    expect(result).toBe(0);
  });
});
