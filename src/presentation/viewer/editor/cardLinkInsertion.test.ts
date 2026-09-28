import { describe, expect, it } from "vitest";
import {
  applyLinkInsertion,
  resolveLinkInsertionTarget,
} from "./cardLinkInsertion.ts";

describe("resolveLinkInsertionTarget", () => {
  it("keeps an empty selection at the caret", () => {
    expect(resolveLinkInsertionTarget("before after", 7, 7)).toEqual({
      start: 7,
      end: 7,
    });
  });

  it("uses a single-line selection as the link text", () => {
    expect(resolveLinkInsertionTarget("before after", 0, 6)).toEqual({
      start: 0,
      end: 6,
      linkText: "before",
    });
  });

  it("collapses a multiline selection at its end without using its text", () => {
    expect(resolveLinkInsertionTarget("one\ntwo\nthree", 0, 7)).toEqual({
      start: 7,
      end: 7,
    });
  });

  it("normalizes a reverse selection", () => {
    expect(resolveLinkInsertionTarget("before after", 6, 0)).toEqual({
      start: 0,
      end: 6,
      linkText: "before",
    });
  });

  it("keeps whitespace-only link text selected by the user", () => {
    expect(resolveLinkInsertionTarget("a   b", 1, 4)).toEqual({
      start: 1,
      end: 4,
      linkText: "   ",
    });
  });
});

describe("applyLinkInsertion", () => {
  it("inserts at an empty selection and leaves the following text intact", () => {
    const value = "before after";
    const markdown = "[Target](./target.md)";
    const target = resolveLinkInsertionTarget(value, 7, 7);

    expect(applyLinkInsertion(value, target, markdown)).toEqual({
      value: `before ${markdown}after`,
      caret: 7 + markdown.length,
    });
  });

  it("replaces the target and reports the resulting caret", () => {
    expect(
      applyLinkInsertion("before selected after", {
        start: 7,
        end: 15,
        linkText: "selected",
      }, "[selected](./target.md)"),
    ).toEqual({
      value: "before [selected](./target.md) after",
      caret: 30,
    });
  });

  it("inserts after a multiline selection without deleting it", () => {
    const value = "one\ntwo\nthree";
    const markdown = "[Target](./target.md)";
    const target = resolveLinkInsertionTarget(value, 0, 7);

    expect(applyLinkInsertion(value, target, markdown)).toEqual({
      value: `one\ntwo${markdown}\nthree`,
      caret: 7 + markdown.length,
    });
  });
});
