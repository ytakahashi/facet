import { describe, expect, it, vi } from "vite-plus/test";
import {
  FileSystemError,
  type FileSystemPort,
} from "../domain/fileSystemPort.ts";
import { duplicateMarkdownCard } from "./duplicateMarkdownCard.ts";
function makeFileSystem(
  overrides: Partial<FileSystemPort> = {},
): FileSystemPort {
  return {
    readTextFile: vi.fn(),
    readTextFileWithRevision: vi.fn(),
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

const card = {
  path: "notes/foo.MD",
  absolutePath: "/board/notes/foo.MD",
  displayTitle: "Override",
  titleOverride: "Override",
  labels: ["work"],
  fileState: "available" as const,
};
const input = { boardPath: "/board/board.yaml", card, reservedPaths: [] };

describe("duplicateMarkdownCard", () => {
  it("copies saved text in the same directory and retains card metadata", async () => {
    const fileSystem = makeFileSystem({
      readTextFile: vi
        .fn()
        .mockResolvedValue("# Saved\r\n\r\n[link](other.md)\r\n"),
    });
    const readTextFile = vi.spyOn(fileSystem, "readTextFile");
    const createTextFile = vi.spyOn(fileSystem, "createTextFile");
    const result = await duplicateMarkdownCard(input, { fileSystem });
    expect(readTextFile).toHaveBeenCalledWith(card.absolutePath);
    expect(createTextFile).toHaveBeenCalledWith(
      "/board/notes/foo_copy.md",
      "# Saved\r\n\r\n[link](other.md)\r\n",
    );
    expect(result).toEqual({
      ...card,
      path: "notes/foo_copy.md",
      absolutePath: "/board/notes/foo_copy.md",
    });
    expect(result.labels).not.toBe(card.labels);
  });

  it("derives the title from the copied text when there is no override", async () => {
    const fileSystem = makeFileSystem({
      readTextFile: vi.fn().mockResolvedValue("# Fresh title\n"),
    });
    const result = await duplicateMarkdownCard(
      { ...input, card: { ...card, titleOverride: undefined } },
      { fileSystem },
    );
    expect(result.displayTitle).toBe("Fresh title");
  });

  it("skips board identities, existing files and an exclusive-create collision", async () => {
    const fileSystem = makeFileSystem({
      readTextFile: vi.fn().mockResolvedValue(""),
      exists: vi.fn().mockResolvedValueOnce(true).mockResolvedValue(false),
      createTextFile: vi
        .fn()
        .mockRejectedValueOnce(
          new FileSystemError("already-exists", "create-file"),
        )
        .mockResolvedValue(undefined),
    });
    const exists = vi.spyOn(fileSystem, "exists");
    const createTextFile = vi.spyOn(fileSystem, "createTextFile");
    const result = await duplicateMarkdownCard(
      { ...input, reservedPaths: ["notes/FOO_COPY.md"] },
      { fileSystem },
    );
    expect(result.path).toBe("notes/foo_copy_4.md");
    expect(exists).not.toHaveBeenCalledWith("/board/notes/foo_copy.md");
    expect(createTextFile).toHaveBeenCalledTimes(2);
  });

  it.each([
    [new FileSystemError("not-found", "read-file"), "card.file-not-found"],
    [new Error("Permission denied"), "card.load-failed"],
  ])("does not create a file after a read failure", async (cause, code) => {
    const fileSystem = makeFileSystem({
      readTextFile: vi.fn().mockRejectedValue(cause),
    });
    const createTextFile = vi.spyOn(fileSystem, "createTextFile");
    await expect(
      duplicateMarkdownCard(input, { fileSystem }),
    ).rejects.toMatchObject({
      code,
      details: { path: card.absolutePath },
      cause,
    });
    expect(createTextFile).not.toHaveBeenCalled();
  });

  it("stops on a creation failure other than a collision", async () => {
    const fileSystem = makeFileSystem({
      readTextFile: vi.fn().mockResolvedValue("body"),
      createTextFile: vi.fn().mockRejectedValue(new Error("Permission denied")),
    });
    const createTextFile = vi.spyOn(fileSystem, "createTextFile");
    await expect(
      duplicateMarkdownCard(input, { fileSystem }),
    ).rejects.toMatchObject({
      code: "card.create-failed",
      details: { path: "/board/notes/foo_copy.md" },
    });
    expect(createTextFile).toHaveBeenCalledOnce();
  });
});
