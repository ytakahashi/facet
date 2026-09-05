// Widths for the Markdown viewer pane, kept free of DOM and React so the
// drag handle only has to measure and the clamping can be unit tested.

export const DEFAULT_VIEWER_WIDTH = 380;
export const MIN_VIEWER_WIDTH = 280;

// How much of the workspace the pane may take. The board scrolls
// horizontally on its own, so what is left of it only has to stay wide
// enough to be worth looking at. Kept in step with the max-width backstop
// on .markdown-viewer, which covers a window shrinking under a width that
// was already set.
const MAX_VIEWER_WIDTH_RATIO = 0.85;

// Keyboard nudge per arrow key press on the handle.
export const VIEWER_WIDTH_STEP = 16;

export function clampViewerWidth(
  width: number,
  workspaceWidth: number,
): number {
  // In a window narrow enough that the upper bound falls below the lower
  // one, the lower bound wins - a pane below MIN_VIEWER_WIDTH cannot show
  // its header, while a squeezed board still scrolls.
  const max = Math.max(
    MIN_VIEWER_WIDTH,
    workspaceWidth * MAX_VIEWER_WIDTH_RATIO,
  );
  return Math.round(Math.min(Math.max(width, MIN_VIEWER_WIDTH), max));
}
