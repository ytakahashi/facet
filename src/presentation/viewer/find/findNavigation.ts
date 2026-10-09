import type { TextRange } from "../../../domain/textMatch.ts";

export function moveFindIndex(
  count: number,
  index: number | undefined,
  direction: 1 | -1,
): number | undefined {
  if (count === 0) return undefined;
  if (index === undefined) return direction === 1 ? 0 : count - 1;
  return (index + direction + count) % count;
}

export function findIndexFromOffset(
  ranges: readonly TextRange[],
  offset: number,
): number | undefined {
  if (ranges.length === 0) return undefined;
  const index = ranges.findIndex((range) => range.start >= offset);
  return index === -1 ? 0 : index;
}

export function nearestFindIndex(
  ranges: readonly TextRange[],
  offset: number,
): number | undefined {
  let nearest: number | undefined;
  let distance = Infinity;
  ranges.forEach((range, index) => {
    const nextDistance = Math.abs(range.start - offset);
    // Equal distances prefer the earlier match in document order.
    if (nextDistance < distance) {
      nearest = index;
      distance = nextDistance;
    }
  });
  return nearest;
}
