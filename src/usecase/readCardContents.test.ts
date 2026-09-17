import { describe, expect, it } from "vitest";
import type { Card } from "../domain/card.ts";
import type { DirEntry, FileSystemPort } from "../domain/fileSystemPort.ts";
import { readCardContents } from "./readCardContents.ts";

function makeCard(path: string, overrides: Partial<Card> = {}): Card {
  return {
    path,
    absolutePath: `/board/${path}`,
    fileState: "available",
    labels: [],
    displayTitle: path,
    ...overrides,
  };
}

function flushPendingTasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

class FakeFileSystemPort implements FileSystemPort {
  readonly readPaths: string[] = [];
  private readonly read: (path: string) => Promise<string>;

  constructor(read: (path: string) => Promise<string>) {
    this.read = read;
  }

  readTextFile(path: string): Promise<string> {
    this.readPaths.push(path);
    return this.read(path);
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

describe("readCardContents", () => {
  it("reads absolute paths and returns results keyed by board-relative path", async () => {
    const available = makeCard("available.md");
    const restored = makeCard("restored.md", { fileState: "missing" });
    const unresolvable = makeCard("outside.md", {
      absolutePath: undefined,
      fileState: "unresolvable",
    });
    const fileSystem = new FakeFileSystemPort((path) =>
      Promise.resolve(`content:${path}`)
    );

    const result = await readCardContents(
      [available, restored, unresolvable],
      { fileSystem },
    );

    expect(result).toEqual([
      {
        path: "available.md",
        read: true,
        content: "content:/board/available.md",
      },
      {
        path: "restored.md",
        read: true,
        content: "content:/board/restored.md",
      },
      { path: "outside.md", read: false },
    ]);
    expect(fileSystem.readPaths).toEqual([
      "/board/available.md",
      "/board/restored.md",
    ]);
  });

  it("keeps input order and continues when individual reads fail", async () => {
    const fileSystem = new FakeFileSystemPort((path) =>
      path.endsWith("broken.md")
        ? Promise.reject(new Error("unreadable"))
        : Promise.resolve(path)
    );

    const result = await readCardContents([
      makeCard("first.md"),
      makeCard("broken.md"),
      makeCard("last.md"),
    ], { fileSystem });

    expect(result).toEqual([
      { path: "first.md", read: true, content: "/board/first.md" },
      { path: "broken.md", read: false },
      { path: "last.md", read: true, content: "/board/last.md" },
    ]);
  });

  it("limits concurrent file reads to eight", async () => {
    let activeReads = 0;
    let maximumActiveReads = 0;
    const completeReads: Array<() => void> = [];
    const fileSystem = new FakeFileSystemPort((path) => {
      activeReads += 1;
      maximumActiveReads = Math.max(maximumActiveReads, activeReads);
      return new Promise((resolve) => {
        completeReads.push(() => {
          activeReads -= 1;
          resolve(path);
        });
      });
    });
    const cards = Array.from(
      { length: 10 },
      (_, index) => makeCard(`card-${index}.md`),
    );

    const reading = readCardContents(cards, { fileSystem });
    await flushPendingTasks();

    expect(fileSystem.readPaths).toHaveLength(8);
    expect(maximumActiveReads).toBe(8);

    completeReads.splice(0, 8).forEach((complete) => complete());
    await flushPendingTasks();

    expect(fileSystem.readPaths).toHaveLength(10);
    completeReads.forEach((complete) => complete());
    await reading;
    expect(maximumActiveReads).toBe(8);
  });

  it("returns an empty result without reading files for an empty input", async () => {
    const fileSystem = new FakeFileSystemPort(() =>
      Promise.reject(new Error("must not read"))
    );

    await expect(readCardContents([], { fileSystem })).resolves.toEqual([]);
    expect(fileSystem.readPaths).toEqual([]);
  });
});
