import { describe, expect, it } from "vitest";
import {
  findIndexFromOffset,
  moveFindIndex,
  nearestFindIndex,
} from "./findNavigation.ts";

const ranges = [{ start: 2, end: 4 }, { start: 10, end: 12 }, {
  start: 18,
  end: 20,
}];

describe("find navigation", () => {
  it("wraps in either direction, including a single result", () => {
    expect(moveFindIndex(3, 2, 1)).toBe(0);
    expect(moveFindIndex(3, 0, -1)).toBe(2);
    expect(moveFindIndex(3, undefined, 1)).toBe(0);
    expect(moveFindIndex(3, undefined, -1)).toBe(2);
    expect(moveFindIndex(1, 0, 1)).toBe(0);
  });
  it("selects at or after the visible offset and wraps when below the last match", () => {
    expect(findIndexFromOffset(ranges, 10)).toBe(1);
    expect(findIndexFromOffset(ranges, 11)).toBe(2);
    expect(findIndexFromOffset(ranges, 25)).toBe(0);
  });
  it("preserves the nearest start, preferring the earlier result on a tie", () => {
    expect(nearestFindIndex(ranges, 11)).toBe(1);
    expect(nearestFindIndex(ranges, 14)).toBe(1);
  });
  it("has no active index without results", () => {
    expect(moveFindIndex(0, undefined, 1)).toBeUndefined();
    expect(findIndexFromOffset([], 10)).toBeUndefined();
    expect(nearestFindIndex([], 10)).toBeUndefined();
  });
});
