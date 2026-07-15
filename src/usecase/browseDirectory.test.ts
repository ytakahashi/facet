import { describe, expect, it } from "vitest";
import type { DirEntry, FileSystemPort } from "../domain/fileSystemPort.ts";
import { getHomeDirectory, listDirectory } from "./browseDirectory.ts";

class FakeFileSystemPort implements FileSystemPort {
  private readonly home: string;
  private readonly dirs: Map<string, DirEntry[]>;

  constructor(home: string, dirs: Record<string, DirEntry[]>) {
    this.home = home;
    this.dirs = new Map(Object.entries(dirs));
  }

  readTextFile(): Promise<string> {
    throw new Error("not needed for this test");
  }

  writeTextFile(): Promise<void> {
    throw new Error("not needed for this test");
  }

  readDir(path: string): Promise<DirEntry[]> {
    return Promise.resolve(this.dirs.get(path) ?? []);
  }

  homeDirectory(): Promise<string> {
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
