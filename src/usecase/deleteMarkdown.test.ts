import { describe, expect, it, vi } from "vitest";
import { FileSystemError } from "../domain/fileSystemPort.ts";
import type { FileSystemPort } from "../domain/fileSystemPort.ts";
import { deleteMarkdown } from "./deleteMarkdown.ts";

function makeFileSystem(
  removeFile: FileSystemPort["removeFile"],
): FileSystemPort {
  return {
    readTextFile: vi.fn(),
    writeTextFile: vi.fn(),
    createTextFile: vi.fn(),
    removeFile,
    renameFile: vi.fn(),
    readDir: vi.fn(),
    homeDirectory: vi.fn(),
    exists: vi.fn(),
    mkdir: vi.fn(),
  };
}

describe("deleteMarkdown", () => {
  it("removes the file at the given path through the file system", async () => {
    const removeFile = vi.fn().mockResolvedValue(undefined);
    const fileSystem = makeFileSystem(removeFile);

    await deleteMarkdown("/board/improve-search.md", { fileSystem });

    expect(removeFile).toHaveBeenCalledWith("/board/improve-search.md");
  });

  it("treats an already-missing file as success", async () => {
    const fileSystem = makeFileSystem(
      vi.fn().mockRejectedValue(
        new FileSystemError(
          "not-found",
          "remove-file",
          "/board/improve-search.md",
        ),
      ),
    );

    await expect(
      deleteMarkdown("/board/improve-search.md", { fileSystem }),
    ).resolves.toBeUndefined();
  });

  it("refuses to report a directory as deleted", async () => {
    const cause = new FileSystemError(
      "is-a-directory",
      "remove-file",
      "/board/notes.md",
    );
    const fileSystem = makeFileSystem(vi.fn().mockRejectedValue(cause));

    const act = () => deleteMarkdown("/board/notes.md", { fileSystem });

    await expect(act).rejects.toMatchObject({
      code: "markdown.delete-failed",
      details: { path: "/board/notes.md" },
      cause,
    });
  });

  it("maps any other removal failure to a Markdown delete error", async () => {
    const cause = new FileSystemError(
      "operation-failed",
      "remove-file",
      "/board/improve-search.md",
    );
    const fileSystem = makeFileSystem(vi.fn().mockRejectedValue(cause));

    const act = () =>
      deleteMarkdown("/board/improve-search.md", { fileSystem });

    await expect(act).rejects.toMatchObject({
      code: "markdown.delete-failed",
      details: { path: "/board/improve-search.md" },
      cause,
    });
  });
});
