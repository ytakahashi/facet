import { describe, expect, it } from "vitest";
import {
  isMermaidCodeBlock,
  type PreElementNode,
} from "./isMermaidCodeBlock.ts";

function pre(className?: unknown): PreElementNode {
  return {
    type: "element",
    children: [{
      type: "element",
      tagName: "code",
      properties: className === undefined ? {} : { className },
    }],
  };
}

describe("isMermaidCodeBlock", () => {
  it("accepts a block fenced as mermaid", () => {
    expect(isMermaidCodeBlock(pre(["language-mermaid"]))).toBe(true);
  });

  it("rejects a block fenced as another language", () => {
    expect(isMermaidCodeBlock(pre(["language-ts"]))).toBe(false);
  });

  it("rejects a block without a language", () => {
    expect(isMermaidCodeBlock(pre())).toBe(false);
  });

  it("rejects a language that only starts with mermaid", () => {
    expect(isMermaidCodeBlock(pre(["language-mermaidx"]))).toBe(false);
  });

  it("ignores a class that is not on the inner code element", () => {
    const node: PreElementNode = {
      type: "element",
      children: [{
        type: "element",
        tagName: "span",
        properties: { className: ["language-mermaid"] },
      }],
    };

    expect(isMermaidCodeBlock(node)).toBe(false);
  });
});
