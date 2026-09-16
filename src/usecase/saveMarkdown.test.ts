import { describe, expect, it } from "vitest";
import {
  type DirEntry,
  FileSystemError,
  type FileSystemPort,
} from "../domain/fileSystemPort.ts";
import { saveMarkdown } from "./saveMarkdown.ts";

class FakeFileSystemPort implements FileSystemPort {
  readonly writes: Array<{
    path: string;
    content: string;
    expectedRevision?: string;
  }> = [];
  private readonly writeError?: Error;

  constructor(writeError?: Error) {
    this.writeError = writeError;
  }

  readTextFile(): Promise<string> {
    throw new Error("not needed for this test");
  }

  readTextFileWithRevision(): Promise<{ content: string; revision: string }> {
    throw new Error("not needed for this test");
  }

  writeTextFile(
    path: string,
    content: string,
    expectedRevision?: string,
  ): Promise<string> {
    if (this.writeError) return Promise.reject(this.writeError);
    this.writes.push({ path, content, expectedRevision });
    return Promise.resolve("revision-2");
  }

  createTextFile(): Promise<void> {
    throw new Error("not needed for this test");
  }

  removeFile(): Promise<void> {
    throw new Error("not needed for this test");
  }

  renameFile(): Promise<void> {
    throw new Error("not needed for this test");
  }

  readDir(): Promise<DirEntry[]> {
    throw new Error("not needed for this test");
  }

  homeDirectory(): Promise<string> {
    throw new Error("not needed for this test");
  }

  exists(): Promise<boolean> {
    throw new Error("not needed for this test");
  }

  mkdir(): Promise<void> {
    throw new Error("not needed for this test");
  }
}

describe("saveMarkdown", () => {
  it("writes the content to the given path through the file system", async () => {
    const fileSystem = new FakeFileSystemPort();

    const result = await saveMarkdown(
      "/board/improve-search.md",
      "# Improve search",
      "revision-1",
      { fileSystem },
    );

    expect(fileSystem.writes).toEqual([
      {
        path: "/board/improve-search.md",
        content: "# Improve search",
        expectedRevision: "revision-1",
      },
    ]);
    expect(result).toBe("revision-2");
  });

  it.each(
    [
      ["revision-mismatch", "markdown.conflict"],
      ["not-found", "markdown.file-gone"],
    ] as const,
  )("maps %s to %s", async (kind, code) => {
    const cause = new FileSystemError(
      kind,
      "write-file",
      "/board/improve-search.md",
    );
    const fileSystem = new FakeFileSystemPort(cause);

    const act = () =>
      saveMarkdown(
        "/board/improve-search.md",
        "# Improve search",
        "revision-1",
        { fileSystem },
      );

    await expect(act).rejects.toMatchObject({
      code,
      details: { path: "/board/improve-search.md" },
      cause,
    });
  });

  it("maps other write failures to a Markdown save error", async () => {
    const fileSystem = new FakeFileSystemPort(new Error("disk full"));

    const act = () =>
      saveMarkdown(
        "/board/improve-search.md",
        "# Improve search",
        "revision-1",
        { fileSystem },
      );

    await expect(act).rejects.toMatchObject({
      code: "markdown.save-failed",
      details: { path: "/board/improve-search.md" },
    });
  });
});
