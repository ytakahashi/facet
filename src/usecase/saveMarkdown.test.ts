import { describe, expect, it } from "vitest";
import type { DirEntry, FileSystemPort } from "../domain/fileSystemPort.ts";
import { saveMarkdown } from "./saveMarkdown.ts";

class FakeFileSystemPort implements FileSystemPort {
  readonly writes: Array<{ path: string; content: string }> = [];
  private readonly writeError?: Error;

  constructor(writeError?: Error) {
    this.writeError = writeError;
  }

  readTextFile(): Promise<string> {
    throw new Error("not needed for this test");
  }

  writeTextFile(path: string, content: string): Promise<void> {
    if (this.writeError) return Promise.reject(this.writeError);
    this.writes.push({ path, content });
    return Promise.resolve();
  }

  createTextFile(): Promise<void> {
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

    await saveMarkdown("/board/improve-search.md", "# Improve search", {
      fileSystem,
    });

    expect(fileSystem.writes).toEqual([
      { path: "/board/improve-search.md", content: "# Improve search" },
    ]);
  });

  it("maps write failures to a Markdown save error", async () => {
    const fileSystem = new FakeFileSystemPort(new Error("disk full"));

    const act = () =>
      saveMarkdown("/board/improve-search.md", "# Improve search", {
        fileSystem,
      });

    await expect(act).rejects.toMatchObject({
      code: "markdown.save-failed",
      details: { path: "/board/improve-search.md" },
    });
  });
});
