import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownPreview } from "./MarkdownPreview.tsx";

function render(markdown: string): string {
  return renderToStaticMarkup(<MarkdownPreview markdown={markdown} />);
}

describe("MarkdownPreview", () => {
  it("enables GitHub Flavored Markdown elements", () => {
    const output = render(`
~~done~~

| Item | Ready |
| --- | --- |
| Preview | Yes |

- [x] Render Markdown
`);

    expect(output).toContain("<del>done</del>");
    expect(output).toContain("<table>");
    expect(output).toContain('type="checkbox"');
    expect(output).toContain("checked");
    expect(output).toContain("disabled");
  });

  it("renders links without a navigable anchor", () => {
    const output = render(`
[Relative](./other.md)
[External](https://example.com)
https://example.org
`);

    expect(output).not.toContain("<a");
    expect(output).toContain('class="markdown-preview__link"');
    expect(output).toContain('title="./other.md"');
    expect(output).toContain('title="https://example.com"');
    expect(output).toContain('title="https://example.org"');
  });

  it("renders image alt text without loading an image", () => {
    const output = render("![Diagram](https://example.com/diagram.png)");

    expect(output).not.toContain("<img");
    expect(output).toContain('class="markdown-preview__image"');
    expect(output).toContain(">Diagram</span>");
  });

  it("does not render raw HTML as an element", () => {
    const output = render("<b>test</b>");

    expect(output).not.toContain("<b>");
    expect(output).toContain("&lt;b&gt;test&lt;/b&gt;");
  });
});
