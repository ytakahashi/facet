import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Card } from "../../domain/card.ts";
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

  it("renders a resolved card link as a button without an anchor", () => {
    const card: Card = {
      path: "notes/target.md",
      fileState: "available",
      labels: [],
      displayTitle: "Target",
    };
    const output = renderToStaticMarkup(
      <MarkdownPreview
        markdown="[Target](./target.md)"
        resolveLink={() => card}
        onOpenCard={() => {}}
      />,
    );

    expect(output).not.toContain("<a");
    expect(output).toContain('<button type="button"');
    expect(output).toContain(
      'class="markdown-preview__link markdown-preview__link--card"',
    );
    expect(output).toContain('title="notes/target.md"');
  });

  it("passes the encoded href to the resolver", () => {
    const resolveLink = vi.fn(() => undefined);

    renderToStaticMarkup(
      <MarkdownPreview
        markdown="[日本語](<./日本語 note.md>)"
        resolveLink={resolveLink}
        onOpenCard={() => {}}
      />,
    );

    expect(resolveLink).toHaveBeenCalledWith(
      "./%E6%97%A5%E6%9C%AC%E8%AA%9E%20note.md",
    );
  });

  it("keeps a resolved link inert when no open callback is provided", () => {
    const card: Card = {
      path: "target.md",
      fileState: "available",
      labels: [],
      displayTitle: "Target",
    };
    const output = renderToStaticMarkup(
      <MarkdownPreview
        markdown="[Target](target.md)"
        resolveLink={() => card}
      />,
    );

    expect(output).not.toContain("<button");
    expect(output).toContain('<span class="markdown-preview__link"');
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
