import { describe, expect, it, vi } from "vitest";
import type { FileSystemPort } from "../domain/fileSystemPort.ts";
import { addExistingMarkdownCard } from "./addExistingMarkdownCard.ts";

function makeFileSystem(
  overrides: Partial<FileSystemPort> = {},
): FileSystemPort {
  return {
    readTextFile: vi.fn().mockResolvedValue("# Existing card\n\nBody"),
    writeTextFile: vi.fn(),
    removeFile: vi.fn(),
    createTextFile: vi.fn(),
    readDir: vi.fn(),
    homeDirectory: vi.fn(),
    exists: vi.fn(),
    mkdir: vi.fn(),
    ...overrides,
  };
}

describe("addExistingMarkdownCard", () => {
  it("reads a Markdown file and returns its relative card reference", async () => {
    const readTextFile = vi.fn().mockResolvedValue("# Existing card\n\nBody");
    const fileSystem = makeFileSystem({ readTextFile });
    const input = {
      boardPath: "/board/development.board.yaml",
      absolutePath: "/board/ideas/existing.md",
    };

    const result = await addExistingMarkdownCard(input, { fileSystem });

    expect(readTextFile).toHaveBeenCalledWith("/board/ideas/existing.md");
    expect(result).toEqual({
      path: "ideas/existing.md",
      absolutePath: "/board/ideas/existing.md",
      fileState: "available",
      labels: [],
      displayTitle: "Existing card",
    });
  });

  it("rejects a file outside the board directory before reading", async () => {
    const readTextFile = vi.fn();
    const fileSystem = makeFileSystem({ readTextFile });
    const input = {
      boardPath: "/board/development.board.yaml",
      absolutePath: "/other/existing.md",
    };

    const act = () => addExistingMarkdownCard(input, { fileSystem });

    await expect(act).rejects.toMatchObject({
      code: "card.outside-board-directory",
    });
    expect(readTextFile).not.toHaveBeenCalled();
  });

  it("rejects a non-Markdown file before reading", async () => {
    const readTextFile = vi.fn();
    const fileSystem = makeFileSystem({ readTextFile });
    const input = {
      boardPath: "/board/development.board.yaml",
      absolutePath: "/board/image.png",
    };

    const act = () => addExistingMarkdownCard(input, { fileSystem });

    await expect(act).rejects.toMatchObject({ code: "card.not-markdown-file" });
    expect(readTextFile).not.toHaveBeenCalled();
  });

  it("maps read failures with the selected path", async () => {
    const cause = new Error("Permission denied");
    const fileSystem = makeFileSystem({
      readTextFile: vi.fn().mockRejectedValue(cause),
    });
    const input = {
      boardPath: "/board/development.board.yaml",
      absolutePath: "/board/existing.md",
    };

    const act = () => addExistingMarkdownCard(input, { fileSystem });

    await expect(act).rejects.toMatchObject({
      code: "card.load-failed",
      details: { path: "/board/existing.md" },
      cause,
    });
  });
});
