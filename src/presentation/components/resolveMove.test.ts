import { attachClosestEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { describe, expect, it } from "vitest";
import type { CardDragData, ColumnDropData } from "./dragData.ts";
import { resolveMove } from "./resolveMove.ts";

// attachClosestEdge only reads element.getBoundingClientRect() and
// input.clientX/clientY, so a real DOM element isn't needed to fabricate
// fixtures - a fake with just those two pieces of geometry is enough.
function cardTargetData(data: CardDragData, edge: "top" | "bottom") {
  const rect = { top: 0, bottom: 100, left: 0, right: 100 } as DOMRect;
  const element = { getBoundingClientRect: () => rect } as Element;
  const input = { clientX: 50, clientY: edge === "top" ? 0 : 100 };
  return attachClosestEdge(data, {
    element,
    // deno-lint-ignore no-explicit-any
    input: input as any,
    allowedEdges: ["top", "bottom"],
  });
}

function cardSource(data: CardDragData) {
  return { data };
}

describe("resolveMove", () => {
  it("returns undefined when the drag source is not a card", () => {
    const result = resolveMove({ data: { type: "column" } }, [
      { data: { type: "column", columnId: "doing" } satisfies ColumnDropData },
    ]);

    expect(result).toBeUndefined();
  });

  it("returns undefined when there are no drop targets", () => {
    const source = cardSource({ type: "card", columnId: "doing", index: 0 });

    const result = resolveMove(source, []);

    expect(result).toBeUndefined();
  });

  it("appends to the end of the column when dropped on empty column space", () => {
    const source = cardSource({ type: "card", columnId: "doing", index: 0 });
    const columnTarget = {
      data: { type: "column", columnId: "done" } satisfies ColumnDropData,
    };

    const result = resolveMove(source, [columnTarget]);

    expect(result).toEqual({
      from: { columnId: "doing", index: 0 },
      to: { columnId: "done", index: Number.POSITIVE_INFINITY },
    });
  });

  it("inserts before the target card when dropped on its top edge", () => {
    const source = cardSource({ type: "card", columnId: "doing", index: 0 });
    const cardTarget = {
      data: cardTargetData(
        { type: "card", columnId: "done", index: 2 },
        "top",
      ),
    };
    const columnTarget = {
      data: { type: "column", columnId: "done" } satisfies ColumnDropData,
    };

    const result = resolveMove(source, [cardTarget, columnTarget]);

    expect(result).toEqual({
      from: { columnId: "doing", index: 0 },
      to: { columnId: "done", index: 2 },
    });
  });

  it("inserts after the target card when dropped on its bottom edge", () => {
    const source = cardSource({ type: "card", columnId: "doing", index: 0 });
    const cardTarget = {
      data: cardTargetData(
        { type: "card", columnId: "done", index: 2 },
        "bottom",
      ),
    };
    const columnTarget = {
      data: { type: "column", columnId: "done" } satisfies ColumnDropData,
    };

    const result = resolveMove(source, [cardTarget, columnTarget]);

    expect(result).toEqual({
      from: { columnId: "doing", index: 0 },
      to: { columnId: "done", index: 3 },
    });
  });
});
