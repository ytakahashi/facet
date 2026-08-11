// Moving through a result list with the arrow keys, kept apart from the
// dialog so the wrapping is testable on its own.
//
// Both ends wrap, so holding an arrow key never dead-ends: the list is short
// and circular movement reaches the far end faster than reversing direction.
// An empty list answers 0 rather than -1, leaving the caller with no empty
// case of its own to carry.
export function nextSelectionIndex(
  current: number,
  count: number,
  delta: number,
): number {
  if (count === 0) return 0;
  return (((current + delta) % count) + count) % count;
}

// Results are recomputed as the query changes and while the board can still
// change underneath an open dialog, so the selection has to be pulled back
// into range at render time rather than only when it moves.
export function clampSelectionIndex(current: number, count: number): number {
  if (count === 0) return 0;
  return Math.min(Math.max(current, 0), count - 1);
}
