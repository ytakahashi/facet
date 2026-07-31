import { describe, expect, it } from "vitest";
import type { Card, CardFileState } from "./card.ts";
import {
  createCardReference,
  isCardFileBroken,
  relocateCardReference,
  resolveCardTitle,
} from "./card.ts";

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

describe("createCardReference", () => {
  it("creates a card with its H1 title and empty board metadata", () => {
    const result = createCardReference(
      "notes/card.md",
      "/board/notes/card.md",
      "# Card title\n\nBody",
    );

    expect(result).toEqual({
      path: "notes/card.md",
      absolutePath: "/board/notes/card.md",
      fileState: "available",
      labels: [],
      displayTitle: "Card title",
    });
  });
});

describe("relocateCardReference", () => {
  function makeBrokenCard(overrides: Partial<Card> = {}): Card {
    return {
      path: "gone.md",
      absolutePath: "/board/gone.md",
      fileState: "missing",
      priority: "high",
      labels: ["search"],
      displayTitle: "gone",
      ...overrides,
    };
  }

  it("points the card at the new file while keeping its board metadata", () => {
    const result = relocateCardReference(
      makeBrokenCard(),
      "ideas/moved.md",
      "/board/ideas/moved.md",
      "# Moved card",
    );

    expect(result).toEqual({
      path: "ideas/moved.md",
      absolutePath: "/board/ideas/moved.md",
      fileState: "available",
      priority: "high",
      labels: ["search"],
      displayTitle: "Moved card",
    });
  });

  it("keeps a title override instead of the new file's heading", () => {
    const result = relocateCardReference(
      makeBrokenCard({ titleOverride: "Custom title" }),
      "ideas/moved.md",
      "/board/ideas/moved.md",
      "# Moved card",
    );

    expect(result.displayTitle).toBe("Custom title");
    expect(result.titleOverride).toBe("Custom title");
  });

  it("falls back to the new file name when it has no heading", () => {
    const result = relocateCardReference(
      makeBrokenCard(),
      "ideas/moved.md",
      "/board/ideas/moved.md",
      "Body without a heading",
    );

    expect(result.displayTitle).toBe("moved");
  });
});

describe("isCardFileBroken", () => {
  function makeCard(fileState: CardFileState): Card {
    return {
      path: "card.md",
      fileState,
      labels: [],
      displayTitle: "Card",
    };
  }

  it("treats a readable card as not broken", () => {
    expect(isCardFileBroken(makeCard("available"))).toBe(false);
  });

  it("treats a card whose file could not be read as broken", () => {
    expect(isCardFileBroken(makeCard("missing"))).toBe(true);
  });

  it("treats an unreadable card as broken", () => {
    expect(isCardFileBroken(makeCard("unreadable"))).toBe(true);
  });

  it("treats a card whose path does not resolve as broken", () => {
    expect(isCardFileBroken(makeCard("unresolvable"))).toBe(true);
  });
});
