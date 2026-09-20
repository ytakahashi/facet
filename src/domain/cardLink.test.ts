import { describe, expect, it } from "vitest";
import type { Board } from "./board.ts";
import type { Card } from "./card.ts";
import {
  cardLinkHref,
  cardLinkMarkdown,
  isLinkableCardPath,
  resolveCardLink,
} from "./cardLink.ts";

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

describe("cardLinkHref", () => {
  it("builds links relative to the source card's directory", () => {
    expect(cardLinkHref("source.md", "target.md")).toBe("./target.md");
    expect(cardLinkHref("source.md", "notes/target.md")).toBe(
      "./notes/target.md",
    );
    expect(cardLinkHref("notes/source.md", "target.md")).toBe("../target.md");
    expect(cardLinkHref("notes/source.md", "other/target.md")).toBe(
      "../other/target.md",
    );
    expect(cardLinkHref("notes/source.md", "notes/child/target.md")).toBe(
      "./child/target.md",
    );
  });

  it("folds case and Unicode composition only while comparing directories", () => {
    expect(cardLinkHref("Notes/source.md", "notes/Target.md")).toBe(
      "./Target.md",
    );
    expect(
      cardLinkHref("caf\u00e9/source.md", "cafe\u0301/Target.md"),
    ).toBe("./Target.md");
  });

  it("encodes characters that would break a Markdown destination", () => {
    expect(
      cardLinkHref(
        "source.md",
        "日本語 note\t(1)#draft?50%\\copy<old>.md",
      ),
    ).toBe(
      "./日本語%20note%09%281%29%23draft%3F50%25%5Ccopy%3Cold%3E.md",
    );
    expect(cardLinkHref("source.md", "note:memo.md")).toBe(
      "./note:memo.md",
    );
  });

  it.each([
    ["/source.md", "target.md"],
    ["source.md", "/target.md"],
    ["source.md", "../target.md"],
    ["source.md", "target.txt"],
  ])("rejects paths that cannot name linked cards: %s -> %s", (from, to) => {
    expect(() => cardLinkHref(from, to)).toThrow(
      "Card link path must name Markdown within the board",
    );
  });

  it("round-trips generated hrefs through the resolver", () => {
    const targets = [
      makeCard({ path: "root.md" }),
      makeCard({ path: "notes/日本語 note.md" }),
      makeCard({ path: "other/topic#one.md" }),
      makeCard({ path: "Notes/note:memo.md" }),
      makeCard({ path: "caf\u00e9/percent%.md" }),
    ];
    const board = makeBoard(targets);
    const sources = ["source.md", "notes/source.md", "deep/child/source.md"];

    for (const source of sources) {
      for (const target of targets) {
        const href = cardLinkHref(source, target.path);
        expect(resolveCardLink(board, source, href)).toBe(target);
      }
    }
  });
});

describe("isLinkableCardPath", () => {
  it.each([
    "target.md",
    "notes/target.MD",
    "notes/../target.md",
  ])("accepts Markdown paths within the board: %s", (path) => {
    expect(isLinkableCardPath(path)).toBe(true);
  });

  it.each([
    "",
    "/target.md",
    "../target.md",
    "notes/../../target.md",
    "target.txt",
  ])("rejects paths a generated card link cannot address: %s", (path) => {
    expect(isLinkableCardPath(path)).toBe(false);
  });
});

describe("cardLinkMarkdown", () => {
  it("uses the card title and escapes structural link-text characters", () => {
    const card = makeCard({
      path: "target.md",
      displayTitle: "Title [one]",
    });

    expect(cardLinkMarkdown("source.md", card)).toBe(
      "[Title \\[one\\]](./target.md)",
    );
    expect(cardLinkMarkdown("source.md", card, "a\\b")).toBe(
      "[a\\\\b](./target.md)",
    );
  });
});
