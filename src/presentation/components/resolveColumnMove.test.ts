import { attachClosestEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { describe, expect, it } from "vitest";
import type { CardDragData, ColumnDragData } from "./dragData.ts";
import { resolveColumnMove } from "./resolveColumnMove.ts";

// attachClosestEdge only reads element.getBoundingClientRect() and
// input.clientX/clientY, so a real DOM element isn't needed to fabricate
// fixtures - a fake with just those two pieces of geometry is enough.
function columnTargetData(data: ColumnDragData, edge: "left" | "right") {
  const rect = { top: 0, bottom: 100, left: 0, right: 100 } as DOMRect;
  const element = { getBoundingClientRect: () => rect } as Element;
  const input = { clientX: edge === "left" ? 0 : 100, clientY: 50 };
  return attachClosestEdge(data, {
    element,
    // deno-lint-ignore no-explicit-any
    input: input as any,
    allowedEdges: ["left", "right"],
  });
}

function columnSource(data: ColumnDragData) {
  return { data };
}

describe("resolveColumnMove", () => {
  it("returns undefined when the drag source is not a column", () => {
    const source = {
      data: {
        type: "card",
        columnId: "doing",
        index: 0,
      } satisfies CardDragData,
    };

    const result = resolveColumnMove(source, [
      {
        data: columnTargetData(
          { type: "column", columnId: "done", index: 2 },
          "left",
        ),
      },
    ]);

    expect(result).toBeUndefined();
  });

  it("returns undefined when there are no drop targets", () => {
    const source = columnSource({
      type: "column",
      columnId: "ideas",
      index: 0,
    });

    const result = resolveColumnMove(source, []);

    expect(result).toBeUndefined();
  });

  it("takes the target's position when dropped on its left edge", () => {
    const source = columnSource({
      type: "column",
      columnId: "ideas",
      index: 0,
    });
    const columnTarget = {
      data: columnTargetData(
        { type: "column", columnId: "done", index: 2 },
        "left",
      ),
    };

    const result = resolveColumnMove(source, [columnTarget]);

    expect(result).toEqual({ columnId: "ideas", toIndex: 2 });
  });

  it("takes the position after the target when dropped on its right edge", () => {
    const source = columnSource({
      type: "column",
      columnId: "ideas",
      index: 0,
    });
    const columnTarget = {
      data: columnTargetData(
        { type: "column", columnId: "done", index: 2 },
        "right",
      ),
    };

    const result = resolveColumnMove(source, [columnTarget]);

    expect(result).toEqual({ columnId: "ideas", toIndex: 3 });
  });
});
