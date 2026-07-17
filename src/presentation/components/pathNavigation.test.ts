import { describe, expect, it } from "vitest";
import {
  joinPath,
  parentWithinRoot,
  relativePathWithinRoot,
  sortDirectoryEntries,
} from "./pathNavigation.ts";

describe("joinPath", () => {
  it("joins a directory and entry with one slash", () => {
    const result = joinPath("/board/ideas", "card.md");

    expect(result).toBe("/board/ideas/card.md");
  });
});

describe("parentWithinRoot", () => {
  it("moves to a parent within the root", () => {
    const result = parentWithinRoot("/board/ideas/later", "/board");

    expect(result).toBe("/board/ideas");
  });

  it("does not move above the root", () => {
    const result = parentWithinRoot("/board", "/board");

    expect(result).toBe("/board");
  });

  it("moves one level at a time when the root is the file-system root", () => {
    const result = parentWithinRoot("/Users/me/project", "/");

    expect(result).toBe("/Users/me");
  });
});

describe("relativePathWithinRoot", () => {
  it("represents the board directory as a dot", () => {
    const result = relativePathWithinRoot("/projects/facet", "/projects/facet");

    expect(result).toBe(".");
  });

  it("returns a path relative to the board directory", () => {
    const result = relativePathWithinRoot(
      "/projects/facet/ideas/later",
      "/projects/facet",
    );

    expect(result).toBe("ideas/later");
  });

  it("handles the file-system root without leaving a leading slash", () => {
    const result = relativePathWithinRoot("/ideas/later", "/");

    expect(result).toBe("ideas/later");
  });
});

describe("sortDirectoryEntries", () => {
  it("sorts directories before files and names within each group", () => {
    const entries = [
      { name: "z.md", isDirectory: false },
      { name: "ideas", isDirectory: true },
      { name: "a.md", isDirectory: false },
    ];

    const result = sortDirectoryEntries(entries);

    expect(result.map((entry) => entry.name)).toEqual([
      "ideas",
      "a.md",
      "z.md",
    ]);
  });
});
