import { describe, expect, it } from "vitest";
import {
  directoryOf,
  hasTrailingPathSeparator,
  normalizeCardPath,
  resolveCardPath,
  toRelativeCardPath,
} from "./boardPath.ts";

describe("resolveCardPath", () => {
  it("resolves a plain relative path under the board directory", () => {
    const result = resolveCardPath("/boards/my-project", "improve-search.md");

    expect(result).toEqual({
      ok: true,
      absolutePath: "/boards/my-project/improve-search.md",
    });
  });

  it("resolves a relative path in a subdirectory", () => {
    const result = resolveCardPath(
      "/boards/my-project",
      "ideas/redesign-sidebar.md",
    );

    expect(result).toEqual({
      ok: true,
      absolutePath: "/boards/my-project/ideas/redesign-sidebar.md",
    });
  });

  it("rejects an absolute path", () => {
    const result = resolveCardPath("/boards/my-project", "/etc/passwd");

    expect(result).toEqual({ ok: false, reason: "absolute-path" });
  });

  it("rejects a path that escapes the board directory", () => {
    const result = resolveCardPath(
      "/boards/my-project",
      "../other-project/task.md",
    );

    expect(result).toEqual({ ok: false, reason: "escapes-board-directory" });
  });
});

describe("hasTrailingPathSeparator", () => {
  it("detects a trailing separator before a typed path is resolved", () => {
    expect(hasTrailingPathSeparator("ideas/  ")).toBe(true);
    expect(hasTrailingPathSeparator("ideas/card.md")).toBe(false);
  });
});

describe("directoryOf", () => {
  it("returns the parent directory of a file path", () => {
    const directory = directoryOf(
      "/boards/my-project/development.board.yaml",
    );

    expect(directory).toBe("/boards/my-project");
  });
});

describe("toRelativeCardPath", () => {
  it("returns a path relative to the board directory", () => {
    const result = toRelativeCardPath(
      "/boards/my-project",
      "/boards/my-project/ideas/card.md",
    );

    expect(result).toEqual({ ok: true, path: "ideas/card.md" });
  });

  it("rejects a sibling directory with the same path prefix", () => {
    const result = toRelativeCardPath(
      "/boards/my-project",
      "/boards/my-project-old/card.md",
    );

    expect(result).toEqual({
      ok: false,
      reason: "outside-board-directory",
    });
  });

  it("rejects the board directory itself", () => {
    const result = toRelativeCardPath(
      "/boards/my-project",
      "/boards/my-project",
    );

    expect(result).toEqual({ ok: false, reason: "not-a-file" });
  });
});

describe("normalizeCardPath", () => {
  it("normalizes dot segments and repeated slashes", () => {
    const result = normalizeCardPath("./ideas//later/../card.md");

    expect(result).toBe("ideas/card.md");
  });
});
