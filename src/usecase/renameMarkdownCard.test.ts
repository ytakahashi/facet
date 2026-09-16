import { describe, expect, it, vi } from "vitest";
import type { Card } from "../domain/card.ts";
import type { FileSystemPort } from "../domain/fileSystemPort.ts";
import { FileSystemError } from "../domain/fileSystemPort.ts";
import { renameMarkdownCard } from "./renameMarkdownCard.ts";

function makeFileSystem(
  overrides: Partial<FileSystemPort> = {},
): FileSystemPort {
  return {
    readTextFile: vi.fn().mockResolvedValue("# Improve search\n\nBody"),
    readTextFileWithRevision: vi.fn(),
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
    path: "improve-search.md",
    absolutePath: "/board/improve-search.md",
    fileState: "available",
    priority: "high",
    labels: ["search"],
    displayTitle: "Improve search",
    ...overrides,
  };
}

describe("renameMarkdownCard", () => {
  it("moves the file and returns the card pointed at where it went", async () => {
    const renameFile = vi.fn();
    const readTextFile = vi.fn().mockResolvedValue("# Improve search\n\nBody");
    const fileSystem = makeFileSystem({ renameFile, readTextFile });

    const result = await renameMarkdownCard({
      boardPath: "/board/development.board.yaml",
      card: makeCard({ titleOverride: "Search" }),
      directory: "/board/ideas",
      fileName: "search.md",
    }, { fileSystem });

    expect(readTextFile).toHaveBeenCalledWith("/board/improve-search.md");
    expect(renameFile).toHaveBeenCalledWith(
      "/board/improve-search.md",
      "/board/ideas/search.md",
    );
    expect(result).toEqual({
      path: "ideas/search.md",
      absolutePath: "/board/ideas/search.md",
      fileState: "available",
      titleOverride: "Search",
      priority: "high",
      labels: ["search"],
      displayTitle: "Search",
    });
  });

  it("reads the file before moving it", async () => {
    const calls: string[] = [];
    const fileSystem = makeFileSystem({
      readTextFile: vi.fn().mockImplementation(() => {
        calls.push("read");
        return Promise.resolve("# Improve search\n");
      }),
      renameFile: vi.fn().mockImplementation(() => {
        calls.push("rename");
        return Promise.resolve();
      }),
    });

    await renameMarkdownCard({
      boardPath: "/board/development.board.yaml",
      card: makeCard(),
      directory: "/board",
      fileName: "search.md",
    }, { fileSystem });

    expect(calls).toEqual(["read", "rename"]);
  });

  it("completes a file name without an extension", async () => {
    const renameFile = vi.fn();
    const fileSystem = makeFileSystem({ renameFile });

    const result = await renameMarkdownCard({
      boardPath: "/board/development.board.yaml",
      card: makeCard(),
      directory: "/board",
      fileName: "search",
    }, { fileSystem });

    expect(renameFile).toHaveBeenCalledWith(
      "/board/improve-search.md",
      "/board/search.md",
    );
    expect(result.path).toBe("search.md");
  });

  it("rejects a destination outside the board directory before moving", async () => {
    const renameFile = vi.fn();
    const fileSystem = makeFileSystem({ renameFile });

    const act = () =>
      renameMarkdownCard({
        boardPath: "/board/development.board.yaml",
        card: makeCard(),
        directory: "/other",
        fileName: "search.md",
      }, { fileSystem });

    await expect(act).rejects.toMatchObject({
      code: "card.outside-board-directory",
    });
    expect(renameFile).not.toHaveBeenCalled();
  });

  it("rejects an invalid file name before moving", async () => {
    const renameFile = vi.fn();
    const fileSystem = makeFileSystem({ renameFile });

    const act = () =>
      renameMarkdownCard({
        boardPath: "/board/development.board.yaml",
        card: makeCard(),
        directory: "/board",
        fileName: "ideas/search.md",
      }, { fileSystem });

    await expect(act).rejects.toMatchObject({
      code: "card.invalid-file-name",
    });
    expect(renameFile).not.toHaveBeenCalled();
  });

  it("reports a source that is no longer there without moving anything", async () => {
    const renameFile = vi.fn();
    const fileSystem = makeFileSystem({
      readTextFile: vi.fn().mockRejectedValue(
        new FileSystemError(
          "not-found",
          "read-file",
          "/board/improve-search.md",
        ),
      ),
      renameFile,
    });

    const act = () =>
      renameMarkdownCard({
        boardPath: "/board/development.board.yaml",
        card: makeCard(),
        directory: "/board/ideas",
        fileName: "search.md",
      }, { fileSystem });

    await expect(act).rejects.toMatchObject({
      code: "card.file-not-found",
      details: { path: "/board/improve-search.md" },
    });
    expect(renameFile).not.toHaveBeenCalled();
  });

  it("reports an unreadable source without moving anything", async () => {
    const renameFile = vi.fn();
    const cause = new FileSystemError(
      "operation-failed",
      "read-file",
      "/board/improve-search.md",
    );
    const fileSystem = makeFileSystem({
      readTextFile: vi.fn().mockRejectedValue(cause),
      renameFile,
    });

    const act = () =>
      renameMarkdownCard({
        boardPath: "/board/development.board.yaml",
        card: makeCard(),
        directory: "/board/ideas",
        fileName: "search.md",
      }, { fileSystem });

    await expect(act).rejects.toMatchObject({
      code: "card.load-failed",
      details: { path: "/board/improve-search.md" },
      cause,
    });
    expect(renameFile).not.toHaveBeenCalled();
  });

  it("reports an occupied destination as a collision at the destination", async () => {
    const fileSystem = makeFileSystem({
      renameFile: vi.fn().mockRejectedValue(
        new FileSystemError(
          "already-exists",
          "rename-file",
          "/board/ideas/search.md",
        ),
      ),
    });

    const act = () =>
      renameMarkdownCard({
        boardPath: "/board/development.board.yaml",
        card: makeCard(),
        directory: "/board/ideas",
        fileName: "search.md",
      }, { fileSystem });

    await expect(act).rejects.toMatchObject({
      code: "card.file-already-exists",
      details: { path: "/board/ideas/search.md" },
    });
  });

  it("reports a directory at the destination apart from a collision", async () => {
    const fileSystem = makeFileSystem({
      renameFile: vi.fn().mockRejectedValue(
        new FileSystemError("is-a-directory", "rename-file", "/board/ideas.md"),
      ),
    });

    const act = () =>
      renameMarkdownCard({
        boardPath: "/board/development.board.yaml",
        card: makeCard(),
        directory: "/board",
        fileName: "ideas.md",
      }, { fileSystem });

    await expect(act).rejects.toMatchObject({
      code: "card.file-is-a-directory",
      details: { path: "/board/ideas.md" },
    });
  });

  it("reports a source that disappeared between the read and the move", async () => {
    const fileSystem = makeFileSystem({
      renameFile: vi.fn().mockRejectedValue(
        new FileSystemError(
          "not-found",
          "rename-file",
          "/board/improve-search.md",
        ),
      ),
    });

    const act = () =>
      renameMarkdownCard({
        boardPath: "/board/development.board.yaml",
        card: makeCard(),
        directory: "/board/ideas",
        fileName: "search.md",
      }, { fileSystem });

    await expect(act).rejects.toMatchObject({
      code: "card.file-not-found",
      details: { path: "/board/improve-search.md" },
    });
  });

  it("reports any other move failure with its cause", async () => {
    const cause = new FileSystemError(
      "operation-failed",
      "rename-file",
      "/board/improve-search.md",
    );
    const fileSystem = makeFileSystem({
      renameFile: vi.fn().mockRejectedValue(cause),
    });

    const act = () =>
      renameMarkdownCard({
        boardPath: "/board/development.board.yaml",
        card: makeCard(),
        directory: "/board/ideas",
        fileName: "search.md",
      }, { fileSystem });

    await expect(act).rejects.toMatchObject({
      code: "card.move-failed",
      details: { path: "/board/ideas/search.md" },
      cause,
    });
  });

  it("re-derives the display title from the new file name when nothing else names the card", async () => {
    const fileSystem = makeFileSystem({
      readTextFile: vi.fn().mockResolvedValue("Body without a heading\n"),
    });

    const result = await renameMarkdownCard({
      boardPath: "/board/development.board.yaml",
      card: makeCard({ displayTitle: "improve-search" }),
      directory: "/board",
      fileName: "search.md",
    }, { fileSystem });

    expect(result.displayTitle).toBe("search");
  });

  it("keeps the display title of a card that has a title override", async () => {
    const fileSystem = makeFileSystem({
      readTextFile: vi.fn().mockResolvedValue("Body without a heading\n"),
    });

    const result = await renameMarkdownCard({
      boardPath: "/board/development.board.yaml",
      card: makeCard({
        titleOverride: "Search",
        displayTitle: "Search",
      }),
      directory: "/board",
      fileName: "search.md",
    }, { fileSystem });

    expect(result.displayTitle).toBe("Search");
  });

  it("keeps the display title of a card whose file has a heading", async () => {
    const fileSystem = makeFileSystem({
      readTextFile: vi.fn().mockResolvedValue("# Improve search\n\nBody"),
    });

    const result = await renameMarkdownCard({
      boardPath: "/board/development.board.yaml",
      card: makeCard(),
      directory: "/board",
      fileName: "search.md",
    }, { fileSystem });

    expect(result.displayTitle).toBe("Improve search");
  });

  it("throws for a card whose path never resolved", async () => {
    const renameFile = vi.fn();
    const fileSystem = makeFileSystem({ renameFile });

    const act = () =>
      renameMarkdownCard({
        boardPath: "/board/development.board.yaml",
        card: makeCard({
          absolutePath: undefined,
          fileState: "unresolvable",
        }),
        directory: "/board",
        fileName: "search.md",
      }, { fileSystem });

    await expect(act).rejects.toThrow(
      "Card path is not resolvable: improve-search.md",
    );
    expect(renameFile).not.toHaveBeenCalled();
  });
});
