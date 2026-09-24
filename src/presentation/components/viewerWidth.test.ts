import { describe, expect, it } from "vitest";
import {
  clampViewerWidth,
  getAvailableViewerWidth,
  MIN_VIEWER_WIDTH,
} from "./viewerWidth.ts";

describe("getAvailableViewerWidth", () => {
  it("subtracts the handle from the board and editor row", () => {
    expect(getAvailableViewerWidth(980, 6)).toBe(974);
  });

  it("never returns a negative width", () => {
    expect(getAvailableViewerWidth(4, 6)).toBe(0);
  });
});

describe("clampViewerWidth", () => {
  it("keeps a width that fits, rounded to a whole pixel", () => {
    expect(clampViewerWidth(420.4, 1200)).toBe(420);
  });

  it("raises a width below the minimum", () => {
    expect(clampViewerWidth(100, 1200)).toBe(MIN_VIEWER_WIDTH);
  });

  it("caps a width at the share of the space left after fixed siblings", () => {
    expect(clampViewerWidth(1180, 974)).toBe(828);
  });

  // How PaneResizer reads the bounds back out for aria-valuemin/max.
  it("answers with the bound itself for a width that cannot be reached", () => {
    expect(clampViewerWidth(Number.NEGATIVE_INFINITY, 1200)).toBe(
      MIN_VIEWER_WIDTH,
    );
    expect(clampViewerWidth(Number.POSITIVE_INFINITY, 1200)).toBe(1020);
  });

  it("uses the available cap when the space is narrower than the preferred minimum", () => {
    expect(clampViewerWidth(500, 300)).toBe(255);
    expect(clampViewerWidth(100, 300)).toBe(255);
    expect(clampViewerWidth(Number.NEGATIVE_INFINITY, 300)).toBe(255);
    expect(clampViewerWidth(Number.POSITIVE_INFINITY, 300)).toBe(255);
    expect(clampViewerWidth(500, 0)).toBe(0);
  });
});
