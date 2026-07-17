import { describe, expect, it } from "vitest";
import {
  joinPath,
  parentWithinRoot,
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
