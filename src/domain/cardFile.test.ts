import { describe, expect, it } from "vitest";
import {
  initialMarkdown,
  normalizeMarkdownFileName,
  resolveNewMarkdownPath,
  suggestMarkdownFileName,
} from "./cardFile.ts";

describe("suggestMarkdownFileName", () => {
  it("converts spaces and path separators while preserving Unicode", () => {
    const result = suggestMarkdownFileName("  検索 / UI: 改善  ");

    expect(result).toBe("検索-UI-改善.md");
  });
});

describe("normalizeMarkdownFileName", () => {
  it("adds the Markdown extension", () => {
    const result = normalizeMarkdownFileName("improve-search");

    expect(result).toBe("improve-search.md");
  });

  it("normalizes the extension casing", () => {
    const result = normalizeMarkdownFileName("improve-search.MD");

    expect(result).toBe("improve-search.md");
  });

  it("rejects a path instead of a single file name", () => {
    const act = () => normalizeMarkdownFileName("notes/card.md");

    expect(act).toThrow("Enter a single valid file name.");
  });
});

describe("initialMarkdown", () => {
  it("creates an H1 followed by an empty line", () => {
    const result = initialMarkdown(" Improve search ");

    expect(result).toBe("# Improve search\n\n");
  });

  it("rejects an empty title", () => {
    const act = () => initialMarkdown("  ");

    expect(act).toThrow("Title is required.");
  });
});

describe("resolveNewMarkdownPath", () => {
  it("resolves a file in a board subdirectory", () => {
    const result = resolveNewMarkdownPath(
      "/board/development.board.yaml",
      "/board/ideas",
      "new idea",
    );

    expect(result).toEqual({
      absolutePath: "/board/ideas/new idea.md",
      relativePath: "ideas/new idea.md",
      fileName: "new idea.md",
    });
  });

  it("rejects a directory outside the board directory", () => {
    const act = () =>
      resolveNewMarkdownPath(
        "/board/development.board.yaml",
        "/other",
        "card.md",
      );

    expect(act).toThrow("Choose a directory inside the board directory.");
  });
});
