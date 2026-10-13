import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { EditorFindBackdrop } from "./EditorFindBackdrop.tsx";

describe("EditorFindBackdrop", () => {
  it("escapes the draft and keeps trailing-line padding outside searchable text", () => {
    const output = renderToStaticMarkup(
      <EditorFindBackdrop
        text={"<script>&\n"}
        backdropRef={{ current: null }}
        textRef={{ current: null }}
      />,
    );
    expect(output).toContain('aria-hidden="true"');
    expect(output).toContain(
      "<span>&lt;script&gt;&amp;\n</span><span> </span>",
    );
  });
});
