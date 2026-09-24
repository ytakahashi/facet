// Widths for the Markdown viewer pane, kept free of DOM and React so the
// drag handle only has to measure and the clamping can be unit tested.

export const DEFAULT_VIEWER_WIDTH = 380;
export const MIN_VIEWER_WIDTH = 280;

// How much of the board and editor row, minus the handle, the pane may take.
// The board scrolls horizontally on its own, so its remaining share only has
// to stay wide enough to be worth looking at.
const MAX_VIEWER_WIDTH_RATIO = 0.85;

// Keyboard nudge per arrow key press on the handle.
export const VIEWER_WIDTH_STEP = 16;

export function getAvailableViewerWidth(
  boardMainWidth: number,
  handleWidth: number,
): number {
  return Math.max(0, boardMainWidth - handleWidth);
}

export function clampViewerWidth(
  width: number,
  availableWidth: number,
): number {
  // At very small widths the available space wins over the preferred minimum;
  // the handle must report the width the pane can actually display.
  const max = Math.max(0, availableWidth * MAX_VIEWER_WIDTH_RATIO);
  const min = Math.min(MIN_VIEWER_WIDTH, max);
  return Math.round(Math.min(Math.max(width, min), max));
}
