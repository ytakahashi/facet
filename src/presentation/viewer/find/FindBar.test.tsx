import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FindBar } from "./FindBar.tsx";

function render(query: string, count: number, activeIndex: number | undefined) {
  return renderToStaticMarkup(
    <FindBar
      query={query}
      count={count}
      activeIndex={activeIndex}
      focusToken={0}
      handledFocusToken={{ current: 0 }}
      onQueryChange={() => {}}
      onNext={() => {}}
      onPrevious={() => {}}
      onClose={() => {}}
    />,
  );
}

describe("FindBar", () => {
  it("renders the current position and labelled controls", () => {
    const output = render("word", 12, 2);
    expect(output).toContain("3 / 12");
    expect(output).toContain('aria-label="Find in preview"');
    expect(output).toContain('aria-label="Previous match"');
    expect(output).toContain('aria-label="Next match"');
    expect(output).toContain('aria-label="Close find"');
    expect(output).not.toContain("disabled");
  });
  it("shows No results and disables navigation for a nonempty query", () => {
    const output = render("missing", 0, undefined);
    expect(output).toContain("No results");
    expect(output).toContain("markdown-find__count--empty");
    expect(output.match(/disabled=""/g)).toHaveLength(2);
  });
  it("does not display an error for an empty query", () => {
    const output = render("", 0, undefined);
    expect(output).not.toContain("No results");
    expect(output).not.toContain("markdown-find__count--empty");
  });
});
