import { describe, expect, it } from "vite-plus/test";
import { applyIndentation, resolveIndentation } from "./editorIndentation.ts";

function indent(
  value: string,
  start: number,
  end: number,
  direction: "indent" | "outdent",
) {
  const edit = resolveIndentation(value, start, end, direction);
  return (
    edit && {
      value: applyIndentation(value, edit),
      selection: [edit.selectionStart, edit.selectionEnd],
    }
  );
}

describe("resolveIndentation", () => {
  it("inserts two spaces at the caret", () => {
    expect(indent("- a\n- b", 4, 4, "indent")).toEqual({
      value: "- a\n  - b",
      selection: [6, 6],
    });
  });

  it("replaces a single-line selection with the indentation", () => {
    expect(indent("abc", 1, 2, "indent")).toEqual({
      value: "a  c",
      selection: [3, 3],
    });
  });

  it("indents every line a multiline selection touches", () => {
    expect(indent("one\ntwo\nthree", 1, 5, "indent")).toEqual({
      value: "  one\n  two\nthree",
      selection: [3, 9],
    });
  });

  it("keeps a selection of whole lines covering them", () => {
    expect(indent("one\ntwo\nthree", 0, 8, "indent")).toEqual({
      value: "  one\n  two\nthree",
      selection: [0, 12],
    });
  });

  it("leaves blank lines empty", () => {
    expect(indent("a\n\nb", 0, 4, "indent")).toEqual({
      value: "  a\n\n  b",
      selection: [0, 8],
    });
  });

  it("normalizes a reverse selection", () => {
    expect(indent("one\ntwo", 5, 1, "indent")?.selection).toEqual([3, 9]);
  });

  it("outdents the caret's line by up to two spaces", () => {
    expect(indent("a\n   - b", 7, 7, "outdent")).toEqual({
      value: "a\n - b",
      selection: [5, 5],
    });
  });

  it("outdents a leading tab", () => {
    expect(indent("\t\tx", 3, 3, "outdent")).toEqual({
      value: "\tx",
      selection: [2, 2],
    });
  });

  it("pulls a caret inside the removed indentation to the line start", () => {
    expect(indent("  x", 1, 1, "outdent")).toEqual({
      value: "x",
      selection: [0, 0],
    });
  });

  it("outdents each line a multiline selection touches", () => {
    expect(indent("  one\n two\nthree", 3, 8, "outdent")).toEqual({
      value: "one\ntwo\nthree",
      selection: [1, 5],
    });
  });

  it("reports no edit when nothing can be outdented", () => {
    expect(resolveIndentation("x\ny", 0, 3, "outdent")).toBeUndefined();
  });
});
