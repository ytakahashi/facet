import { describe, expect, it } from "vitest";
import { findTextMatches } from "./textMatch.ts";

describe("findTextMatches", () => {
  it("matches case-insensitively without overlapping", () => {
    expect(findTextMatches("aaaa AA", "aa")).toEqual([{ start: 0, end: 2 }, {
      start: 2,
      end: 4,
    }, { start: 5, end: 7 }]);
  });

  it("returns original offsets across decomposed accents and surrogate pairs", () => {
    expect(findTextMatches("😀 Cafe\u0301 café", "CAFÉ")).toEqual([{
      start: 3,
      end: 8,
    }, { start: 9, end: 13 }]);
    expect(findTextMatches("café", "cafe\u0301")).toEqual([{
      start: 0,
      end: 4,
    }]);
  });

  it("maps folds that expand a grapheme without accepting partial matches", () => {
    expect(findTextMatches("İ x İ", "i\u0307")).toEqual([{ start: 0, end: 1 }, {
      start: 4,
      end: 5,
    }]);
    expect(findTextMatches("İ i", "i")).toEqual([{ start: 2, end: 3 }]);
    expect(findTextMatches("İ", "\u0307")).toEqual([]);
  });

  it("rejects matches inside combining sequences and joined emoji", () => {
    expect(findTextMatches("x\u0301 x", "x")).toEqual([{ start: 3, end: 4 }]);
    expect(findTextMatches("👩‍💻 👩", "👩")).toEqual([{ start: 6, end: 8 }]);
    expect(findTextMatches("👍🏽", "👍")).toEqual([]);
  });

  it("uses the same contextual lowercase fold as canonicalSearchText", () => {
    expect(findTextMatches("ΟΣ ΟΣ", "ΟΣ")).toEqual([{ start: 0, end: 2 }, {
      start: 3,
      end: 5,
    }]);
    expect(findTextMatches("ΟΣ", "οσ")).toEqual([]);
  });

  it("preserves surrounding whitespace and treats an empty query as no matches", () => {
    expect(findTextMatches("a a  a", " a ")).toEqual([{ start: 1, end: 4 }]);
    expect(findTextMatches("a a", " ")).toEqual([{ start: 1, end: 2 }]);
    expect(findTextMatches("abc", "")).toEqual([]);
    expect(findTextMatches("", "a")).toEqual([]);
  });
});
