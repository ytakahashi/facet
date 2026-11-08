import { describe, expect, it } from "vite-plus/test";
import {
  isPointInsideSelection,
  type SelectionGeometry,
} from "./isPointInsideSelection.ts";

function selectionOver(
  ...lines: { left: number; right: number; top: number; bottom: number }[]
): SelectionGeometry {
  return {
    isCollapsed: false,
    rangeCount: 1,
    getRangeAt: () => ({ getClientRects: () => lines }),
  };
}

const firstLine = { left: 100, right: 300, top: 10, bottom: 30 };
const secondLine = { left: 20, right: 60, top: 30, bottom: 50 };

describe("isPointInsideSelection", () => {
  it("is true on any line of the selection", () => {
    const selection = selectionOver(firstLine, secondLine);

    expect(isPointInsideSelection(selection, 200, 20)).toBe(true);
    expect(isPointInsideSelection(selection, 40, 40)).toBe(true);
  });

  it("is false beside the selected part of a line", () => {
    const selection = selectionOver(firstLine, secondLine);

    expect(isPointInsideSelection(selection, 50, 20)).toBe(false);
    expect(isPointInsideSelection(selection, 200, 40)).toBe(false);
  });

  it("is false without a selection or for a caret", () => {
    expect(isPointInsideSelection(null, 200, 20)).toBe(false);
    expect(
      isPointInsideSelection(
        { ...selectionOver(firstLine), isCollapsed: true },
        200,
        20,
      ),
    ).toBe(false);
    expect(
      isPointInsideSelection(
        { ...selectionOver(firstLine), rangeCount: 0 },
        200,
        20,
      ),
    ).toBe(false);
  });
});
