import { describe, expect, it } from "vitest";
import { createPaneLayoutStore } from "./paneLayoutStore.ts";
import { DEFAULT_VIEWER_WIDTH } from "../components/viewerWidth.ts";

describe("createPaneLayoutStore", () => {
  it("starts at the default viewer width", () => {
    const usePaneLayout = createPaneLayoutStore();

    expect(usePaneLayout.getState().viewerWidth).toBe(DEFAULT_VIEWER_WIDTH);
  });

  it("keeps the width it is given", () => {
    const usePaneLayout = createPaneLayoutStore();

    usePaneLayout.getState().setViewerWidth(520);

    expect(usePaneLayout.getState().viewerWidth).toBe(520);
  });

  it("goes back to the default width on reset", () => {
    const usePaneLayout = createPaneLayoutStore();
    usePaneLayout.getState().setViewerWidth(520);

    usePaneLayout.getState().resetViewerWidth();

    expect(usePaneLayout.getState().viewerWidth).toBe(DEFAULT_VIEWER_WIDTH);
  });
});
