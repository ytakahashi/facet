import { describe, expect, it } from "vitest";
import type { DirEntry, FileSystemPort } from "../domain/fileSystemPort.ts";
import { viewMarkdown } from "./viewMarkdown.ts";

class FakeFileSystemPort implements FileSystemPort {
  private readonly files: Map<string, string>;

  constructor(files: Record<string, string>) {
    this.files = new Map(Object.entries(files));
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

  readTextFile(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) {
      return Promise.reject(new Error(`file not found: ${path}`));
    }
    return Promise.resolve(content);
  }

  writeTextFile(): Promise<void> {
    throw new Error("not needed for this test");
  }

  createTextFile(): Promise<void> {
    throw new Error("not needed for this test");
  }

  exists(): Promise<boolean> {
    throw new Error("not needed for this test");
  }

  mkdir(): Promise<void> {
    throw new Error("not needed for this test");
  }
}

describe("viewMarkdown", () => {
  it("reads the file at the given path through the file system", async () => {
    const fileSystem = new FakeFileSystemPort({
      "/board/improve-search.md": "# Improve search",
    });

    const result = await viewMarkdown("/board/improve-search.md", {
      fileSystem,
    });

    expect(result).toBe("# Improve search");
  });

  it("maps read failures to a Markdown load error", async () => {
    const fileSystem = new FakeFileSystemPort({});

    const act = () => viewMarkdown("/board/missing.md", { fileSystem });

    await expect(act).rejects.toMatchObject({
      code: "markdown.load-failed",
      details: { path: "/board/missing.md" },
    });
  });
});
