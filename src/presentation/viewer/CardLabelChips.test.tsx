import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";
import type { LabelColor } from "../../domain/label.ts";
import { CardLabelChips } from "./CardLabelChips.tsx";

const colors = new Map<string, LabelColor>([
  ["bug", "ruby"],
  ["docs", "sapphire"],
]);

describe("CardLabelChips", () => {
  it("marks the labels selected in the filter as pressed", () => {
    const html = renderToStaticMarkup(
      <CardLabelChips
        labels={["bug", "docs"]}
        colors={colors}
        selected={new Set(["docs"])}
        onToggle={vi.fn()}
      />,
    );

    expect(html).toMatch(
      /<button[^>]*class="card__label card__label--ruby [^"]*"[^>]*aria-pressed="false"[^>]*>bug<\/button>/,
    );
    expect(html).toMatch(
      /<button[^>]*class="card__label card__label--sapphire [^"]*"[^>]*aria-pressed="true"[^>]*>docs<\/button>/,
    );
  });

  it("leaves a label missing from the registry as plain text", () => {
    const html = renderToStaticMarkup(
      <CardLabelChips
        labels={["stray"]}
        colors={colors}
        selected={new Set()}
        onToggle={vi.fn()}
      />,
    );

    expect(html).toBe(
      '<span class="card__label card__label--neutral">stray</span>',
    );
  });
});
