interface SelectionRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface SelectionGeometry {
  isCollapsed: boolean;
  rangeCount: number;
  getRangeAt(index: number): {
    getClientRects(): ArrayLike<SelectionRect>;
  };
}

// Compares against the selection's line boxes rather than asking whether the
// event target is in the selection: the target of a click beside a partly
// selected paragraph is that paragraph, which counts as selected.
export function isPointInsideSelection(
  selection: SelectionGeometry | null,
  clientX: number,
  clientY: number,
): boolean {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return false;
  }
  return Array.from(selection.getRangeAt(0).getClientRects()).some(
    (rect) =>
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom,
  );
}
