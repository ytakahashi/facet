import { extractClosestEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";

interface DropTargetLike {
  data: Record<string | symbol, unknown>;
}

export interface ResolvedColumnMove {
  columnId: string;
  toIndex: number;
}

// The column counterpart to resolveMove: turns a drop event into the position
// the dragged column should take. Kept free of DOM/React so it can be unit
// tested with plain fixtures.
// A column is never nested in another column and the dragged column excludes
// itself from being a target, so unlike a card drop there is no target stack
// to walk - the innermost target is the whole answer.
export function resolveColumnMove(
  source: { data: Record<string, unknown> },
  dropTargets: readonly DropTargetLike[],
): ResolvedColumnMove | undefined {
  if (source.data.type !== "column") return undefined;
  if (dropTargets.length === 0) return undefined;

  const target = dropTargets[0].data;
  if (target.type !== "column") return undefined;

  const edge = extractClosestEdge(target);
  const targetIndex = target.index as number;

  return {
    columnId: source.data.columnId as string,
    toIndex: edge === "right" ? targetIndex + 1 : targetIndex,
  };
}
