import { describe, expect, it, vi } from "vitest";
import type { FileSystemPort } from "../domain/fileSystemPort.ts";
import { createBoardDirectory } from "./createBoardDirectory.ts";

function makeFileSystem(
  overrides: Partial<FileSystemPort> = {},
): FileSystemPort {
  return {
    readTextFile: vi.fn(),
    writeTextFile: vi.fn(),
    createTextFile: vi.fn(),
    readDir: vi.fn(),
    homeDirectory: vi.fn(),
    exists: vi.fn().mockResolvedValue(false),
    mkdir: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("createBoardDirectory", () => {
  it("creates a directory below the selected parent", async () => {
    const mkdir = vi.fn().mockResolvedValue(undefined);
    const fileSystem = makeFileSystem({ mkdir });

    const result = await createBoardDirectory("/board/ideas", " later ", {
      fileSystem,
    });

    expect(result).toBe("/board/ideas/later");
    expect(mkdir).toHaveBeenCalledWith("/board/ideas/later");
  });

  it("rejects a path instead of a single directory name", async () => {
    const mkdir = vi.fn();
    const fileSystem = makeFileSystem({ mkdir });

    const act = () =>
      createBoardDirectory("/board", "ideas/later", { fileSystem });

    await expect(act).rejects.toThrow("single valid directory name");
    expect(mkdir).not.toHaveBeenCalled();
  });

  it("does not call mkdir when the target already exists", async () => {
    const mkdir = vi.fn();
    const fileSystem = makeFileSystem({
      exists: vi.fn().mockResolvedValue(true),
      mkdir,
    });

    const act = () => createBoardDirectory("/board", "ideas", { fileSystem });

    await expect(act).rejects.toThrow("already exists");
    expect(mkdir).not.toHaveBeenCalled();
  });
});
