import { describe, expect, it } from "vitest";
import {
  initialMarkdown,
  normalizeMarkdownFileName,
  resolveExistingMarkdownPath,
  resolveNewMarkdownPath,
  resolveNewMarkdownPathAt,
  suggestMarkdownFileName,
} from "./cardFile.ts";

describe("suggestMarkdownFileName", () => {
  it("converts spaces and path separators while preserving Unicode", () => {
    const result = suggestMarkdownFileName("  検索 / UI: 改善  ");

    expect(result).toBe("検索-UI-改善.md");
  });
});

describe("resolveExistingMarkdownPath", () => {
  it("resolves Markdown in a board subdirectory", () => {
    expect(resolveExistingMarkdownPath(
      "/board/development.board.yaml",
      "/board/ideas/existing.md",
    )).toEqual({
      absolutePath: "/board/ideas/existing.md",
      relativePath: "ideas/existing.md",
    });
  });

  it("rejects a file outside the board directory", () => {
    const act = () =>
      resolveExistingMarkdownPath(
        "/board/development.board.yaml",
        "/other/existing.md",
      );

    expect(act).toThrow(
      expect.objectContaining({ kind: "outside-board-directory" }),
    );
  });

  it("rejects a non-Markdown file", () => {
    const act = () =>
      resolveExistingMarkdownPath(
        "/board/development.board.yaml",
        "/board/existing.txt",
      );

    expect(act).toThrow(
      expect.objectContaining({ kind: "not-markdown-file" }),
    );
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

    expect(act).toThrow(expect.objectContaining({ kind: "invalid-file-name" }));
  });
});

describe("initialMarkdown", () => {
  it("creates an H1 followed by an empty line", () => {
    const result = initialMarkdown(" Improve search ");

    expect(result).toBe("# Improve search\n\n");
  });

  it("rejects an empty title", () => {
    const act = () => initialMarkdown("  ");

    expect(act).toThrow(expect.objectContaining({ kind: "title-required" }));
  });
});

describe("resolveNewMarkdownPathAt", () => {
  it("splits a chosen path into a directory and a file name", () => {
    const result = resolveNewMarkdownPathAt(
      "/board/development.board.yaml",
      "/board/ideas/new idea.md",
    );

    expect(result).toEqual({
      absolutePath: "/board/ideas/new idea.md",
      relativePath: "ideas/new idea.md",
      fileName: "new idea.md",
    });
  });

  it("applies the same file-name normalization as a picked directory", () => {
    const result = resolveNewMarkdownPathAt(
      "/board/development.board.yaml",
      "/board/notes",
    );

    expect(result.relativePath).toBe("notes.md");
  });

  it("rejects a path outside the board directory", () => {
    const act = () =>
      resolveNewMarkdownPathAt(
        "/board/development.board.yaml",
        "/other/card.md",
      );

    expect(act).toThrow(
      expect.objectContaining({ kind: "outside-board-directory" }),
    );
  });

  it("rejects a path with no file name", () => {
    const act = () =>
      resolveNewMarkdownPathAt("/board/development.board.yaml", "/board/");

    expect(act).toThrow(
      expect.objectContaining({ kind: "file-name-required" }),
    );
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

    expect(act).toThrow(
      expect.objectContaining({ kind: "outside-board-directory" }),
    );
  });
});
