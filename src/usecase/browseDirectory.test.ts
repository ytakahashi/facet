import { describe, expect, it } from "vitest";
import type { DirEntry, FileSystemPort } from "../domain/fileSystemPort.ts";
import { getHomeDirectory, listDirectory } from "./browseDirectory.ts";

class FakeFileSystemPort implements FileSystemPort {
  private readonly home: string;
  private readonly dirs: Map<string, DirEntry[]>;
  private readonly failure?: Error;

  constructor(
    home: string,
    dirs: Record<string, DirEntry[]>,
    failure?: Error,
  ) {
    this.home = home;
    this.dirs = new Map(Object.entries(dirs));
    this.failure = failure;
  }

  readTextFile(): Promise<string> {
    throw new Error("not needed for this test");
  }

  readTextFileWithRevision(): Promise<{ content: string; revision: string }> {
    throw new Error("not needed for this test");
  }

  writeTextFile(): Promise<string> {
    throw new Error("not needed for this test");
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

  readDir(path: string): Promise<DirEntry[]> {
    if (this.failure) return Promise.reject(this.failure);
    return Promise.resolve(this.dirs.get(path) ?? []);
  }

  homeDirectory(): Promise<string> {
    if (this.failure) return Promise.reject(this.failure);
    return Promise.resolve(this.home);
  }

  exists(): Promise<boolean> {
    throw new Error("not needed for this test");
  }

  mkdir(): Promise<void> {
    throw new Error("not needed for this test");
  }
}

describe("listDirectory", () => {
  it("lists the entries at the given path through the file system", async () => {
    const entries: DirEntry[] = [
      { name: "development.board.yaml", isDirectory: false },
      { name: "ideas", isDirectory: true },
    ];
    const fileSystem = new FakeFileSystemPort("/Users/me", {
      "/Users/me/project": entries,
    });

    const result = await listDirectory("/Users/me/project", { fileSystem });

    expect(result).toEqual(entries);
  });
});

describe("getHomeDirectory", () => {
  it("returns the home directory from the file system", async () => {
    const fileSystem = new FakeFileSystemPort("/Users/me", {});

    const result = await getHomeDirectory({ fileSystem });

    expect(result).toBe("/Users/me");
  });
});

describe("directory errors", () => {
  it("maps directory read failures with the requested path", async () => {
    const fileSystem = new FakeFileSystemPort(
      "/Users/me",
      {},
      new Error("Permission denied"),
    );

    const act = () => listDirectory("/Users/me/private", { fileSystem });

    await expect(act).rejects.toMatchObject({
      code: "directory.browse-failed",
      details: { path: "/Users/me/private" },
    });
  });

  it("maps home directory failures", async () => {
    const fileSystem = new FakeFileSystemPort(
      "/Users/me",
      {},
      new Error("HOME unavailable"),
    );

    const act = () => getHomeDirectory({ fileSystem });

    await expect(act).rejects.toMatchObject({ code: "directory.home-failed" });
  });
});
