import { describe, expect, it } from "vitest";
import { findTextMatches } from "../../../domain/textMatch.ts";
import { editorFindText, selectedFindQuery } from "./editorFindText.ts";

describe("editor find text", () => {
  it("maps CRLF and CR drafts to textarea offsets without changing Unicode", () => {
    const draft = "first\r\nsecond\rCafe\u0301 😀\n";
    const text = editorFindText(draft);
    expect(text).toBe("first\nsecond\nCafe\u0301 😀\n");
    expect(findTextMatches(text, "café")).toEqual([{ start: 13, end: 18 }]);
    expect(findTextMatches(text, "😀")).toEqual([{ start: 19, end: 21 }]);
  });

  it("preserves tabs, spaces and final blank lines", () => {
    expect(editorFindText("\t word \n\n")).toBe("\t word \n\n");
    expect(editorFindText("")).toBe("");
  });

  it("seeds a query from a single-line selection without trimming it", () => {
    expect(selectedFindQuery("one\n two \nthree", 4, 9)).toBe(" two ");
    expect(selectedFindQuery("one\n two \nthree", 9, 4)).toBe(" two ");
    expect(selectedFindQuery("😀Cafe\u0301", 2, 7)).toBe("Cafe\u0301");
  });

  it("retains the previous query for a caret or multiline selection", () => {
    expect(selectedFindQuery("one\ntwo", 1, 1)).toBeUndefined();
    expect(selectedFindQuery("one\ntwo", 0, 7)).toBeUndefined();
    expect(selectedFindQuery("one\rtwo", 0, 7)).toBeUndefined();
  });
});
