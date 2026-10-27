import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { EditorLineNumbers } from "./EditorLineNumbers.tsx";

describe("EditorLineNumbers", () => {
  it("hides the gutter from assistive technology", () => {
    const output = renderToStaticMarkup(
      <EditorLineNumbers
        lineCount={1}
        layout={[{ top: 8 }]}
        contentRef={{ current: null }}
      />,
    );
    expect(output).toContain(
      'class="markdown-editor-gutter" aria-hidden="true"',
    );
  });

  it("hides numbers until their positions have been measured", () => {
    const output = renderToStaticMarkup(
      <EditorLineNumbers
        lineCount={2}
        layout={[]}
        contentRef={{ current: null }}
      />,
    );
    expect(
      output.match(/class="markdown-editor-line-number" hidden=""/g),
    ).toHaveLength(2);
  });

  it("positions numbers at measured logical line starts after wrapping", () => {
    const output = renderToStaticMarkup(
      <EditorLineNumbers
        lineCount={3}
        layout={[{ top: 8 }, { top: 48 }, { top: 68 }]}
        contentRef={{ current: null }}
      />,
    );
    expect(output).toContain('style="top:8px">1</span>');
    expect(output).toContain('style="top:48px">2</span>');
    expect(output).toContain('style="top:68px">3</span>');
    expect(output).not.toContain('hidden=""');
  });
});
