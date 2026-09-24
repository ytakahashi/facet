import { attachClosestEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { describe, expect, it } from "vitest";
import type { LabelDragData } from "./dragData.ts";
import { resolveLabelMove } from "./resolveLabelMove.ts";

function target(index: number, edge: "top" | "bottom") {
  const data: LabelDragData = { type: "label", name: "target", index };
  const rect = { top: 0, bottom: 100, left: 0, right: 100 } as DOMRect;
  return {
    data: attachClosestEdge(data, {
      element: { getBoundingClientRect: () => rect } as Element,
      // deno-lint-ignore no-explicit-any
      input: { clientX: 50, clientY: edge === "top" ? 0 : 100 } as any,
      allowedEdges: ["top", "bottom"],
    }),
  };
}

describe("resolveLabelMove", () => {
  const source = { data: { type: "label", name: "source", index: 0 } };

  it("ignores other drag types and missing targets", () => {
    expect(resolveLabelMove({ data: { type: "card" } }, [target(1, "top")]))
      .toBeUndefined();
    expect(resolveLabelMove(source, [])).toBeUndefined();
    expect(resolveLabelMove(source, [{ data: { type: "column" } }]))
      .toBeUndefined();
  });

  it("resolves drops above and below a row", () => {
    expect(resolveLabelMove(source, [target(1, "top")]))
      .toEqual({ name: "source", toIndex: 1 });
    expect(resolveLabelMove(source, [target(1, "bottom")]))
      .toEqual({ name: "source", toIndex: 2 });
  });
});
