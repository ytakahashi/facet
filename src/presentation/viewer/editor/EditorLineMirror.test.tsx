import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { EditorLineMirror } from "./EditorLineMirror.tsx";

describe("EditorLineMirror", () => {
  it("preserves consecutive and final empty lines with zero-width spaces", () => {
    const output = renderToStaticMarkup(
      <EditorLineMirror
        lines={["first", "", "", "last", ""]}
        mirrorRef={{ current: null }}
      />,
    );
    expect(output).toContain(
      "<div>first</div><div>\u200b</div><div>\u200b</div><div>last</div><div>\u200b</div>",
    );
  });

  it("hides the measurement copy from assistive technology", () => {
    const output = renderToStaticMarkup(
      <EditorLineMirror lines={[""]} mirrorRef={{ current: null }} />,
    );
    expect(output).toContain(
      'class="markdown-editor-line-mirror" aria-hidden="true"',
    );
  });
});
