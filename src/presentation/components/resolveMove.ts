import { extractClosestEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import type { CardLocation } from "../../domain/board.ts";

interface DropTargetLike {
  data: Record<string | symbol, unknown>;
}

export interface ResolvedMove {
  from: CardLocation;
  to: CardLocation;
}

// The one place that turns a pragmatic-drag-and-drop drop event into a
// domain-level move. Kept free of DOM/React so it can be unit tested with
// plain fixtures. dropTargets is ordered innermost-first: a drop directly on
// a card hits both the card and its column (length 2), a drop on empty
// column space only hits the column (length 1).
export function resolveMove(
  source: { data: Record<string, unknown> },
  dropTargets: readonly DropTargetLike[],
): ResolvedMove | undefined {
  if (source.data.type !== "card") return undefined;
  const from: CardLocation = {
    columnId: source.data.columnId as string,
    index: source.data.index as number,
  };

  if (dropTargets.length === 0) return undefined;

  if (dropTargets.length === 1) {
    const columnData = dropTargets[0].data;
    if (columnData.type !== "column") return undefined;
    return {
      from,
      to: {
        columnId: columnData.columnId as string,
        index: Number.POSITIVE_INFINITY,
      },
    };
  }

  const [cardTarget, columnTarget] = dropTargets;
  if (
    cardTarget.data.type !== "card" || columnTarget.data.type !== "column"
  ) {
    return undefined;
  }

  const edge = extractClosestEdge(cardTarget.data);
  const targetIndex = cardTarget.data.index as number;

  return {
    from,
    to: {
      columnId: columnTarget.data.columnId as string,
      index: edge === "bottom" ? targetIndex + 1 : targetIndex,
    },
  };
}
