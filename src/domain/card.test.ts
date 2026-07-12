import { describe, expect, it } from "vitest";
import { resolveCardTitle } from "./card.ts";

describe("resolveCardTitle", () => {
  it("uses the YAML title override when present", () => {
    const title = resolveCardTitle(
      "Custom title",
      "# Markdown heading",
      "notes.md",
    );

    expect(title).toBe("Custom title");
  });

  it("uses the first H1 heading when there is no title override", () => {
    const markdown = "Some intro text\n# Improve search\nDetails";

    const title = resolveCardTitle(undefined, markdown, "improve-search.md");

    expect(title).toBe("Improve search");
  });

  it("falls back to the filename when there is no title override or H1 heading", () => {
    const markdown = "Just a paragraph, no heading.";

    const title = resolveCardTitle(undefined, markdown, "improve-search.md");

    expect(title).toBe("improve-search");
  });

  it("falls back to the filename when the markdown is unavailable", () => {
    const title = resolveCardTitle(undefined, undefined, "improve-search.md");

    expect(title).toBe("improve-search");
  });
});
