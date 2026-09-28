import { describe, expect, it } from "vitest";
import { type CodeBlockNode, codeBlockText } from "./codeBlockText.ts";

function pre(...children: CodeBlockNode[]): CodeBlockNode {
  return {
    type: "element",
    children: [{ type: "element", children }],
  };
}

function text(value: string): CodeBlockNode {
  return { type: "text", value };
}

describe("codeBlockText", () => {
  it("drops the one trailing newline the renderer appends", () => {
    expect(codeBlockText(pre(text("const a = 1;\n")))).toBe("const a = 1;");
  });

  it("keeps blank lines and indentation the author wrote", () => {
    expect(codeBlockText(pre(text("  a\n\n  b\n\n")))).toBe("  a\n\n  b\n");
  });

  it("returns an empty string for an empty block", () => {
    expect(codeBlockText(pre())).toBe("");
  });

  it("collects text from nested elements in order", () => {
    const node = pre(
      { type: "element", children: [text("const")] },
      text(" a = "),
      {
        type: "element",
        children: [{ type: "element", children: [text("1")] }],
      },
      text(";\n"),
    );

    expect(codeBlockText(node)).toBe("const a = 1;");
  });

  it("ignores nodes that are neither text nor elements", () => {
    const node = pre(
      text("a"),
      { type: "comment", value: "hidden" },
      text("\n"),
    );

    expect(codeBlockText(node)).toBe("a");
  });
});
