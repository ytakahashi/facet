import { describe, expect, it } from "vitest";
import { directoryOf, resolveCardPath } from "./boardPath.ts";

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

describe("directoryOf", () => {
  it("returns the parent directory of a file path", () => {
    const directory = directoryOf(
      "/boards/my-project/development.board.yaml",
    );

    expect(directory).toBe("/boards/my-project");
  });
});
