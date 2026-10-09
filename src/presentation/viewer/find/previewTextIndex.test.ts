import { describe, expect, it } from "vitest";
import {
  buildPreviewTextIndex,
  locatePreviewRange,
  type PreviewTextPart,
} from "./previewTextIndex.ts";

function text(node: string, value: string): PreviewTextPart<string> {
  return { kind: "text", node, text: value };
}
const boundary: PreviewTextPart<string> = { kind: "boundary" };

describe("previewTextIndex", () => {
  it("separates blocks without duplicating nested boundaries or existing line breaks", () => {
    const index = buildPreviewTextIndex([
      boundary,
      text("p", "one"),
      boundary,
      boundary,
      text("li", "two"),
      boundary,
      text("pre", "code\n"),
      boundary,
      text("cell", "three"),
      boundary,
    ]);
    expect(index.text).toBe("one\ntwo\ncode\nthree");
    expect(index.nodes.map(({ start, end }) => [start, end])).toEqual([
      [0, 3],
      [4, 7],
      [8, 13],
      [13, 18],
    ]);
  });
  it("maps ranges spanning inline formatting and links", () => {
    const index = buildPreviewTextIndex([
      text("plain", "a "),
      text("bold", "bold"),
      text("link", " link"),
    ]);
    expect(index.text).toBe("a bold link");
    expect(locatePreviewRange(index, { start: 3, end: 9 })).toEqual({
      start: { node: "bold", offset: 1 },
      end: { node: "link", offset: 3 },
    });
  });
  it("uses the next node for a start and the previous node for an end at a shared boundary", () => {
    const index = buildPreviewTextIndex([
      text("first", "ab"),
      text("second", "cd"),
    ]);
    expect(locatePreviewRange(index, { start: 2, end: 4 })).toEqual({
      start: { node: "second", offset: 0 },
      end: { node: "second", offset: 2 },
    });
    expect(locatePreviewRange(index, { start: 0, end: 2 })).toEqual({
      start: { node: "first", offset: 0 },
      end: { node: "first", offset: 2 },
    });
  });
  it("does not create DOM endpoints for virtual newlines or invalid offsets", () => {
    const index = buildPreviewTextIndex([
      text("first", "ab"),
      boundary,
      text("second", "cd"),
    ]);
    for (
      const range of [
        { start: 2, end: 3 },
        { start: 0, end: 3 },
        { start: -1, end: 1 },
        { start: 1, end: 1 },
        { start: 0, end: 6 },
      ]
    ) {
      expect(locatePreviewRange(index, range)).toBeUndefined();
    }
    expect(buildPreviewTextIndex([boundary, text("empty", ""), boundary]))
      .toEqual({ text: "", nodes: [] });
  });
});
