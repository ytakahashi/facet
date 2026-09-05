import { describe, expect, it } from "vitest";
import { clampViewerWidth, MIN_VIEWER_WIDTH } from "./viewerWidth.ts";

describe("clampViewerWidth", () => {
  it("keeps a width that fits, rounded to a whole pixel", () => {
    expect(clampViewerWidth(420.4, 1200)).toBe(420);
  });

  it("raises a width below the minimum", () => {
    expect(clampViewerWidth(100, 1200)).toBe(MIN_VIEWER_WIDTH);
  });

  it("caps a width at the share of the workspace the pane may take", () => {
    expect(clampViewerWidth(1180, 1200)).toBe(1020);
  });

  // How PaneResizer reads the bounds back out for aria-valuemin/max.
  it("answers with the bound itself for a width that cannot be reached", () => {
    expect(clampViewerWidth(Number.NEGATIVE_INFINITY, 1200)).toBe(
      MIN_VIEWER_WIDTH,
    );
    expect(clampViewerWidth(Number.POSITIVE_INFINITY, 1200)).toBe(1020);
  });

  it("prefers the minimum when the workspace cannot hold both", () => {
    expect(clampViewerWidth(500, 300)).toBe(MIN_VIEWER_WIDTH);
    expect(clampViewerWidth(100, 300)).toBe(MIN_VIEWER_WIDTH);
  });
});
