import { describe, expect, it } from "vitest";
import { createPaneLayoutStore } from "./paneLayoutStore.ts";

describe("createPaneLayoutStore", () => {
  it("starts at the default viewer width", () => {
    const usePaneLayout = createPaneLayoutStore();

    expect(usePaneLayout.getState().viewerWidth).toBe(380);
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

    expect(usePaneLayout.getState().viewerWidth).toBe(380);
  });

  it("starts in edit mode", () => {
    const usePaneLayout = createPaneLayoutStore();

    expect(usePaneLayout.getState().viewerMode).toBe("edit");
  });

  it("keeps the selected mode independently of the viewer width", () => {
    const usePaneLayout = createPaneLayoutStore();

    usePaneLayout.getState().setViewerMode("preview");
    usePaneLayout.getState().setViewerWidth(520);
    usePaneLayout.getState().resetViewerWidth();

    expect(usePaneLayout.getState().viewerMode).toBe("preview");
  });
});
