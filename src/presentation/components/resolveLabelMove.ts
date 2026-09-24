import { extractClosestEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";

interface DropTargetLike {
  data: Record<string | symbol, unknown>;
}

export function resolveLabelMove(
  source: { data: Record<string, unknown> },
  dropTargets: readonly DropTargetLike[],
): { name: string; toIndex: number } | undefined {
  if (source.data.type !== "label" || dropTargets.length === 0) {
    return undefined;
  }
  const target = dropTargets[0].data;
  if (target.type !== "label") return undefined;
  const edge = extractClosestEdge(target);
  const index = target.index as number;
  return {
    name: source.data.name as string,
    toIndex: edge === "bottom" ? index + 1 : index,
  };
}
