import { describe, expect, it, vi } from "vitest";
import type { Card } from "../domain/card.ts";
import type { FileSystemPort } from "../domain/fileSystemPort.ts";
import { FileSystemError } from "../domain/fileSystemPort.ts";
import { relocateMarkdownCard } from "./relocateMarkdownCard.ts";

function makeFileSystem(
  overrides: Partial<FileSystemPort> = {},
): FileSystemPort {
  return {
    readTextFile: vi.fn().mockResolvedValue("# Moved card\n\nBody"),
    writeTextFile: vi.fn(),
    removeFile: vi.fn(),
    renameFile: vi.fn(),
    createTextFile: vi.fn(),
    readDir: vi.fn(),
    homeDirectory: vi.fn(),
    exists: vi.fn(),
    mkdir: vi.fn(),
    ...overrides,
  };
}

function makeCard(overrides: Partial<Card> = {}): Card {
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

describe("relocateMarkdownCard", () => {
  it("reads the chosen file and returns the card pointed at it", async () => {
    const readTextFile = vi.fn().mockResolvedValue("# Moved card\n\nBody");
    const fileSystem = makeFileSystem({ readTextFile });

    const result = await relocateMarkdownCard({
      boardPath: "/board/development.board.yaml",
      card: makeCard(),
      absolutePath: "/board/ideas/moved.md",
    }, { fileSystem });

    expect(readTextFile).toHaveBeenCalledWith("/board/ideas/moved.md");
    expect(result).toEqual({
      path: "ideas/moved.md",
      absolutePath: "/board/ideas/moved.md",
      fileState: "available",
      priority: "high",
      labels: ["search"],
      displayTitle: "Moved card",
    });
  });

  it("re-reads the path the card already has", async () => {
    const fileSystem = makeFileSystem();

    const result = await relocateMarkdownCard({
      boardPath: "/board/development.board.yaml",
      card: makeCard(),
      absolutePath: "/board/gone.md",
    }, { fileSystem });

    expect(result.path).toBe("gone.md");
    expect(result.fileState).toBe("available");
  });

  it("rejects a file outside the board directory before reading", async () => {
    const readTextFile = vi.fn();
    const fileSystem = makeFileSystem({ readTextFile });

    const act = () =>
      relocateMarkdownCard({
        boardPath: "/board/development.board.yaml",
        card: makeCard(),
        absolutePath: "/other/moved.md",
      }, { fileSystem });

    await expect(act).rejects.toMatchObject({
      code: "card.outside-board-directory",
    });
    expect(readTextFile).not.toHaveBeenCalled();
  });

  it("rejects a non-Markdown file before reading", async () => {
    const readTextFile = vi.fn();
    const fileSystem = makeFileSystem({ readTextFile });

    const act = () =>
      relocateMarkdownCard({
        boardPath: "/board/development.board.yaml",
        card: makeCard(),
        absolutePath: "/board/image.png",
      }, { fileSystem });

    await expect(act).rejects.toMatchObject({ code: "card.not-markdown-file" });
    expect(readTextFile).not.toHaveBeenCalled();
  });

  it("reports a missing file apart from other read failures", async () => {
    const cause = new FileSystemError(
      "not-found",
      "read-file",
      "/board/moved.md",
    );
    const fileSystem = makeFileSystem({
      readTextFile: vi.fn().mockRejectedValue(cause),
    });

    const act = () =>
      relocateMarkdownCard({
        boardPath: "/board/development.board.yaml",
        card: makeCard(),
        absolutePath: "/board/moved.md",
      }, { fileSystem });

    await expect(act).rejects.toMatchObject({
      code: "card.file-not-found",
      details: { path: "/board/moved.md" },
      cause,
    });
  });

  it("maps any other read failure with the chosen path", async () => {
    const cause = new FileSystemError(
      "operation-failed",
      "read-file",
      "/board/moved.md",
    );
    const fileSystem = makeFileSystem({
      readTextFile: vi.fn().mockRejectedValue(cause),
    });

    const act = () =>
      relocateMarkdownCard({
        boardPath: "/board/development.board.yaml",
        card: makeCard(),
        absolutePath: "/board/moved.md",
      }, { fileSystem });

    await expect(act).rejects.toMatchObject({
      code: "card.load-failed",
      details: { path: "/board/moved.md" },
      cause,
    });
  });
});
