import { extractClosestEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import type { CardLocation } from "../../domain/board.ts";

interface DropTargetLike {
  data: Record<string | symbol, unknown>;
}

export interface ResolvedMove {
  from: CardLocation;
  to: CardLocation;
}

// Turns a pragmatic-drag-and-drop drop event into a domain-level card move.
// Kept free of DOM/React so it can be unit tested with plain fixtures.
// dropTargets is ordered innermost-first: a drop directly on a card hits both
// the card and the card list around it (length 2), a drop on empty column
// space only hits the card list (length 1). Column drop targets never appear
// here, because they only accept column drags.
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
    const cardListData = dropTargets[0].data;
    if (cardListData.type !== "card-list") return undefined;
    return {
      from,
      to: {
        columnId: cardListData.columnId as string,
        index: Number.POSITIVE_INFINITY,
      },
    };
  }

  const [cardTarget, cardListTarget] = dropTargets;
  if (
    cardTarget.data.type !== "card" || cardListTarget.data.type !== "card-list"
  ) {
    return undefined;
  }

  const edge = extractClosestEdge(cardTarget.data);
  const targetIndex = cardTarget.data.index as number;

  return {
    from,
    to: {
      columnId: cardListTarget.data.columnId as string,
      index: edge === "bottom" ? targetIndex + 1 : targetIndex,
    },
  };
}
