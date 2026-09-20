import { describe, expect, it } from "vitest";
import type { Board } from "./board.ts";
import type { Card } from "./card.ts";
import { resolveCardLink } from "./cardLink.ts";

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    path: "card.md",
    fileState: "available",
    labels: [],
    displayTitle: "Card",
    ...overrides,
  };
}

function makeBoard(cards: readonly Card[]): Board {
  return {
    version: 1,
    name: "Board",
    labels: [],
    columns: [{ id: "column", name: "Column", cards: [...cards] }],
  };
}

describe("resolveCardLink", () => {
  it("resolves relative paths from the directory of the source card", () => {
    const root = makeCard({ path: "target.md" });
    const peer = makeCard({ path: "notes/target.md" });
    const child = makeCard({ path: "notes/child/target.md" });
    const sibling = makeCard({ path: "other/target.md" });
    const board = makeBoard([root, peer, child, sibling]);

    expect(resolveCardLink(board, "source.md", "target.md")).toBe(root);
    expect(resolveCardLink(board, "notes/source.md", "target.md")).toBe(peer);
    expect(resolveCardLink(board, "notes/source.md", "child/target.md")).toBe(
      child,
    );
    expect(resolveCardLink(board, "notes/source.md", "../other/target.md"))
      .toBe(sibling);
  });

  it("normalizes redundant path segments", () => {
    const target = makeCard({ path: "notes/b.md" });
    const board = makeBoard([target]);

    expect(resolveCardLink(board, "notes/source.md", "./a/../b.md")).toBe(
      target,
    );
  });

  it("decodes filenames before matching cards", () => {
    const japanese = makeCard({ path: "notes/日本語 note.md" });
    const hash = makeCard({ path: "notes/topic#one.md" });
    const board = makeBoard([japanese, hash]);

    expect(
      resolveCardLink(
        board,
        "notes/source.md",
        "%E6%97%A5%E6%9C%AC%E8%AA%9E%20note.md",
      ),
    ).toBe(japanese);
    expect(resolveCardLink(board, "notes/source.md", "topic%23one.md")).toBe(
      hash,
    );
  });

  it("ignores a query or fragment without confusing encoded delimiters", () => {
    const target = makeCard({ path: "notes/target.md" });
    const question = makeCard({ path: "notes/topic?one.md" });
    const board = makeBoard([target, question]);

    expect(resolveCardLink(board, "notes/source.md", "target.md?mode=1")).toBe(
      target,
    );
    expect(resolveCardLink(board, "notes/source.md", "target.md#heading")).toBe(
      target,
    );
    expect(resolveCardLink(board, "notes/source.md", "topic%3Fone.md")).toBe(
      question,
    );
  });

  it("matches Markdown extensions, letter case, and Unicode composition", () => {
    const target = makeCard({ path: "Notes/caf\u00e9.MD" });
    const uppercaseExtension = makeCard({ path: "target.md" });
    const board = makeBoard([target, uppercaseExtension]);

    expect(
      resolveCardLink(board, "source.md", "notes/cafe%CC%81.md"),
    ).toBe(target);
    expect(resolveCardLink(board, "source.md", "target.MD")).toBe(
      uppercaseExtension,
    );
  });

  it("can resolve a card whose file was missing at the last read", () => {
    const missing = makeCard({ path: "missing.md", fileState: "missing" });

    expect(resolveCardLink(makeBoard([missing]), "source.md", "missing.md"))
      .toBe(missing);
  });

  it.each([
    "",
    "#heading",
    "?mode=1",
    "http://example.com/target.md",
    "https://example.com/target.md",
    "mailto:person@example.com",
    "file:///tmp/target.md",
    "//example.com/target.md",
    "/absolute.md",
    "%2Fencoded-absolute.md",
    "../../outside.md",
    "target.markdown",
    "target.txt",
    "target",
    "%E0%A4%A.md",
  ])("leaves an ineligible href inert: %s", (href) => {
    const board = makeBoard([makeCard({ path: "target.md" })]);

    expect(resolveCardLink(board, "notes/source.md", href)).toBeUndefined();
  });

  it("returns undefined when no card has the resolved Markdown path", () => {
    expect(resolveCardLink(makeBoard([]), "source.md", "target.md"))
      .toBeUndefined();
  });
});
