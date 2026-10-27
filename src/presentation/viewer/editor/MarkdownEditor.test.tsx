import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { createEmptyBoard } from "../../../domain/board.ts";
import { MarkdownEditor } from "./MarkdownEditor.tsx";

function render(value: string): string {
  return renderToStaticMarkup(
    <MarkdownEditor
      value={value}
      board={createEmptyBoard("Board")}
      fromPath="note.md"
      onChange={() => {}}
    />,
  );
}

function lineNumbers(output: string): number[] {
  return Array.from(
    output.matchAll(/class="markdown-editor-line-number"[^>]*>(\d+)</g),
    (match) => Number(match[1]),
  );
}

describe("MarkdownEditor line numbers", () => {
  it("numbers the empty document and retains consecutive and final empty lines", () => {
    expect(lineNumbers(render(""))).toEqual([1]);
    expect(lineNumbers(render("first\n\nlast\n"))).toEqual([1, 2, 3, 4]);
  });

  it("counts logical lines using textarea newline semantics", () => {
    expect(lineNumbers(render("first\r\nsecond\rthird\n"))).toEqual([
      1, 2, 3, 4,
    ]);
  });
});
