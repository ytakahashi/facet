import { describe, expect, it } from "vitest";
import {
  normalizeBoardFileName,
  normalizeBoardName,
  resolveNewBoardPath,
} from "./boardFile.ts";

describe("normalizeBoardName", () => {
  it("trims surrounding whitespace", () => {
    const result = normalizeBoardName("  Development  ");

    expect(result).toBe("Development");
  });

  it("rejects a blank name", () => {
    const act = () => normalizeBoardName("   ");

    expect(act).toThrow(expect.objectContaining({ kind: "name-required" }));
  });
});

describe("normalizeBoardFileName", () => {
  it("adds the yaml extension", () => {
    const result = normalizeBoardFileName("tasks");

    expect(result).toBe("tasks.yaml");
  });

  it("keeps a yml extension", () => {
    const result = normalizeBoardFileName("tasks.yml");

    expect(result).toBe("tasks.yml");
  });

  it("normalizes the extension casing", () => {
    const result = normalizeBoardFileName("tasks.YAML");

    expect(result).toBe("tasks.yaml");
  });

  it("rejects a blank file name", () => {
    const act = () => normalizeBoardFileName("   ");

    expect(act).toThrow(
      expect.objectContaining({ kind: "file-name-required" }),
    );
  });

  it("rejects a path instead of a single file name", () => {
    const act = () => normalizeBoardFileName("boards/tasks.yaml");

    expect(act).toThrow(expect.objectContaining({ kind: "invalid-file-name" }));
  });

  it("rejects directory traversal names", () => {
    const act = () => normalizeBoardFileName("..");

    expect(act).toThrow(expect.objectContaining({ kind: "invalid-file-name" }));
  });
});

describe("resolveNewBoardPath", () => {
  it("joins the directory and the normalized file name", () => {
    const result = resolveNewBoardPath("/home/user/boards", "tasks");

    expect(result).toEqual({
      absolutePath: "/home/user/boards/tasks.yaml",
      fileName: "tasks.yaml",
    });
  });

  it("does not duplicate the separator for a directory ending with a slash", () => {
    const result = resolveNewBoardPath("/", "tasks.yaml");

    expect(result).toEqual({
      absolutePath: "/tasks.yaml",
      fileName: "tasks.yaml",
    });
  });
});
