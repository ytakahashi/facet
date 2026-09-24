import { describe, expect, it } from "vitest";
import { orderCardLabels } from "./label.ts";

describe("orderCardLabels", () => {
  it("uses registry order and leaves unknown names visible at the end", () => {
    const labels = ["later", "unknown-a", "first", "unknown-b"];
    const positions = new Map([["first", 0], ["later", 1]]);

    expect(orderCardLabels(labels, positions)).toEqual([
      "first",
      "later",
      "unknown-a",
      "unknown-b",
    ]);
    expect(labels).toEqual(["later", "unknown-a", "first", "unknown-b"]);
  });
});
