import { describe, expect, it } from "vitest";
import { viewBoxSize } from "./prepareMermaidSvg.ts";

describe("viewBoxSize", () => {
  it("uses the full diagram dimensions, independent of its origin", () => {
    expect(viewBoxSize("-12 -8 1600 240")).toEqual({
      width: 1600,
      height: 240,
    });
  });

  it("accepts comma separators, whitespace and fractional dimensions", () => {
    expect(viewBoxSize(" 0, 0, 120.5, 80.25 \n")).toEqual({
      width: 120.5,
      height: 80.25,
    });
  });

  it("accepts dimensions in scientific notation", () => {
    expect(viewBoxSize("0 0 1.6e3 2.4e2")).toEqual({
      width: 1600,
      height: 240,
    });
  });

  it.each([
    null,
    "",
    " ",
    "0 0 100",
    "0 0 100 200 300",
    "0 0 0 100",
    "0 0 100 0",
    "0 0 -100 200",
    "0 0 100 -200",
    "0 0 NaN 200",
    "0 0 100 Infinity",
    "NaN 0 100 200",
  ])("does not derive a size from an invalid viewBox: %s", (viewBox) => {
    expect(viewBoxSize(viewBox)).toBeUndefined();
  });
});
