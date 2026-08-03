import { describe, expect, it, vi } from "vitest";
import {
  FileSystemError,
  type FileSystemPort,
} from "../domain/fileSystemPort.ts";
import { createMarkdownCard } from "./createMarkdownCard.ts";

function makeFileSystem(
  overrides: Partial<FileSystemPort> = {},
): FileSystemPort {
  return {
    readTextFile: vi.fn(),
    writeTextFile: vi.fn(),
    removeFile: vi.fn(),
    renameFile: vi.fn(),
    createTextFile: vi.fn().mockResolvedValue(undefined),
    readDir: vi.fn(),
    homeDirectory: vi.fn(),
    exists: vi.fn().mockResolvedValue(false),
    mkdir: vi.fn(),
    ...overrides,
  };
}

describe("createMarkdownCard", () => {
  it("creates a Markdown file exclusively and returns its card reference", async () => {
    const createTextFile = vi.fn().mockResolvedValue(undefined);
    const fileSystem = makeFileSystem({ createTextFile });
    const input = {
      boardPath: "/board/development.board.yaml",
      directory: "/board/ideas",
      fileName: "Improve search",
      title: "Improve search",
    };

    const result = await createMarkdownCard(input, { fileSystem });

    expect(createTextFile).toHaveBeenCalledWith(
      "/board/ideas/Improve search.md",
      "# Improve search\n\n",
    );
    expect(result).toEqual({
      path: "ideas/Improve search.md",
      absolutePath: "/board/ideas/Improve search.md",
      fileState: "available",
      labels: [],
      displayTitle: "Improve search",
    });
  });

  it("does not create a file when the target already exists", async () => {
    const createTextFile = vi.fn();
    const fileSystem = makeFileSystem({
      exists: vi.fn().mockResolvedValue(true),
      createTextFile,
    });
    const input = {
      boardPath: "/board/development.board.yaml",
      directory: "/board",
      fileName: "card.md",
      title: "Card",
    };

    const act = () => createMarkdownCard(input, { fileSystem });

    await expect(act).rejects.toMatchObject({
      code: "card.file-already-exists",
      details: { path: "/board/card.md" },
    });
    expect(createTextFile).not.toHaveBeenCalled();
  });

  it("does not touch the file system for an invalid title", async () => {
    const exists = vi.fn();
    const fileSystem = makeFileSystem({ exists });
    const input = {
      boardPath: "/board/development.board.yaml",
      directory: "/board",
      fileName: "card.md",
      title: " ",
    };

    const act = () => createMarkdownCard(input, { fileSystem });

    await expect(act).rejects.toMatchObject({ code: "card.title-required" });
    expect(exists).not.toHaveBeenCalled();
  });

  it("reports an exclusive-create race as an already-exists error", async () => {
    const createTextFile = vi.fn().mockRejectedValue(
      new FileSystemError("already-exists", "create-file", "/board/card.md"),
    );
    const fileSystem = makeFileSystem({ createTextFile });
    const input = {
      boardPath: "/board/development.board.yaml",
      directory: "/board",
      fileName: "card.md",
      title: "Card",
    };

    const act = () => createMarkdownCard(input, { fileSystem });

    await expect(act).rejects.toMatchObject({
      code: "card.file-already-exists",
    });
    expect(createTextFile).toHaveBeenCalledTimes(1);
  });

  it("preserves a create failure that is not an already-exists race", async () => {
    const createTextFile = vi.fn().mockRejectedValue(
      new Error("Permission denied"),
    );
    const fileSystem = makeFileSystem({ createTextFile });
    const input = {
      boardPath: "/board/development.board.yaml",
      directory: "/board",
      fileName: "card.md",
      title: "Card",
    };

    const act = () => createMarkdownCard(input, { fileSystem });

    await expect(act).rejects.toMatchObject({
      code: "card.create-failed",
      cause: expect.objectContaining({ message: "Permission denied" }),
    });
  });
});
