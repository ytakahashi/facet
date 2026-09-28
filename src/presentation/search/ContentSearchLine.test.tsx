import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ContentLineHit } from "../../domain/cardContentSearch.ts";
import { ContentSearchLine } from "./ContentSearchLine.tsx";

function render(hit: ContentLineHit): string {
  return renderToStaticMarkup(<ContentSearchLine hit={hit} />);
}

describe("ContentSearchLine", () => {
  it("renders every matching range and the text between them", () => {
    const output = render({
      lineNumber: 12,
      snippet: "aXXbXXc",
      truncatedStart: false,
      truncatedEnd: false,
      ranges: [{ start: 1, end: 3 }, { start: 4, end: 6 }],
    });

    expect(output).toContain(">12:</span>");
    expect(output).toContain("a<mark>XX</mark>b<mark>XX</mark>c");
  });

  it("shows truncation without inventing a highlight", () => {
    const output = render({
      lineNumber: 3,
      snippet: "plain text",
      truncatedStart: true,
      truncatedEnd: true,
      ranges: [],
    });

    expect(output).toContain("…plain text…");
    expect(output).not.toContain("<mark>");
  });

  it("renders source markup as text", () => {
    const output = render({
      lineNumber: 1,
      snippet: "<script>bad()</script>",
      truncatedStart: false,
      truncatedEnd: false,
      ranges: [{ start: 8, end: 13 }],
    });

    expect(output).toContain("&lt;script&gt;<mark>bad()</mark>&lt;/script&gt;");
    expect(output).not.toContain("<script>");
  });

  it("uses UTF-16 ranges without splitting an emoji", () => {
    const output = render({
      lineNumber: 1,
      snippet: "😀match",
      truncatedStart: false,
      truncatedEnd: false,
      ranges: [{ start: 2, end: 7 }],
    });

    expect(output).toContain("😀<mark>match</mark>");
    expect(output).not.toContain("�");
  });

  it("marks a match that starts the snippet", () => {
    const output = render({
      lineNumber: 1,
      snippet: "matchtail",
      truncatedStart: false,
      truncatedEnd: false,
      ranges: [{ start: 0, end: 5 }],
    });

    expect(output).toContain("<mark>match</mark>tail");
  });
});
