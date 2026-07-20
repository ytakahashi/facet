import { describe, expect, it, vi } from "vitest";
import type { BoardRepository } from "../domain/boardRepository.ts";
import {
  FileSystemError,
  type FileSystemPort,
} from "../domain/fileSystemPort.ts";
import { createBoard } from "./createBoard.ts";

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
    mkdir: vi.fn(),
    ...overrides,
  };
}

function makeBoardRepository(
  overrides: Partial<BoardRepository> = {},
): BoardRepository {
  return {
    load: vi.fn(),
    save: vi.fn(),
    create: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("createBoard", () => {
  it("creates an empty board file and returns its absolute path", async () => {
    const create = vi.fn().mockResolvedValue(undefined);
    const boardRepository = makeBoardRepository({ create });
    const fileSystem = makeFileSystem();
    const input = {
      directory: "/home/user/boards",
      fileName: "facet.board.yaml",
      name: "  My Board  ",
    };

    const result = await createBoard(input, { fileSystem, boardRepository });

    expect(result).toBe("/home/user/boards/facet.board.yaml");
    expect(create).toHaveBeenCalledWith(
      "/home/user/boards/facet.board.yaml",
      { version: 1, name: "My Board", labels: [], columns: [] },
    );
  });

  it("appends the yaml extension to an extensionless file name", async () => {
    const create = vi.fn().mockResolvedValue(undefined);
    const boardRepository = makeBoardRepository({ create });
    const fileSystem = makeFileSystem();
    const input = {
      directory: "/home/user/boards",
      fileName: "tasks",
      name: "Tasks",
    };

    const result = await createBoard(input, { fileSystem, boardRepository });

    expect(result).toBe("/home/user/boards/tasks.yaml");
  });

  it("does not touch the file system for a blank board name", async () => {
    const exists = vi.fn();
    const fileSystem = makeFileSystem({ exists });
    const boardRepository = makeBoardRepository();
    const input = {
      directory: "/home/user/boards",
      fileName: "facet.board.yaml",
      name: "   ",
    };

    const act = () => createBoard(input, { fileSystem, boardRepository });

    await expect(act).rejects.toMatchObject({ code: "board.name-required" });
    expect(exists).not.toHaveBeenCalled();
  });

  it("does not touch the file system for an invalid file name", async () => {
    const exists = vi.fn();
    const fileSystem = makeFileSystem({ exists });
    const boardRepository = makeBoardRepository();
    const input = {
      directory: "/home/user/boards",
      fileName: "boards/tasks.yaml",
      name: "Tasks",
    };

    const act = () => createBoard(input, { fileSystem, boardRepository });

    await expect(act).rejects.toMatchObject({
      code: "board.invalid-file-name",
    });
    expect(exists).not.toHaveBeenCalled();
  });

  it("does not create a file when the target already exists", async () => {
    const create = vi.fn();
    const fileSystem = makeFileSystem({
      exists: vi.fn().mockResolvedValue(true),
    });
    const boardRepository = makeBoardRepository({ create });
    const input = {
      directory: "/home/user/boards",
      fileName: "facet.board.yaml",
      name: "My Board",
    };

    const act = () => createBoard(input, { fileSystem, boardRepository });

    await expect(act).rejects.toMatchObject({
      code: "board.file-already-exists",
      details: { path: "/home/user/boards/facet.board.yaml" },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("reports an exclusive-create race as an already-exists error", async () => {
    const create = vi.fn().mockRejectedValue(
      new FileSystemError(
        "already-exists",
        "create-file",
        "/home/user/boards/facet.board.yaml",
      ),
    );
    const boardRepository = makeBoardRepository({ create });
    const fileSystem = makeFileSystem();
    const input = {
      directory: "/home/user/boards",
      fileName: "facet.board.yaml",
      name: "My Board",
    };

    const act = () => createBoard(input, { fileSystem, boardRepository });

    await expect(act).rejects.toMatchObject({
      code: "board.file-already-exists",
    });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("preserves a create failure that is not an already-exists race", async () => {
    const create = vi.fn().mockRejectedValue(new Error("Permission denied"));
    const boardRepository = makeBoardRepository({ create });
    const fileSystem = makeFileSystem();
    const input = {
      directory: "/home/user/boards",
      fileName: "facet.board.yaml",
      name: "My Board",
    };

    const act = () => createBoard(input, { fileSystem, boardRepository });

    await expect(act).rejects.toMatchObject({
      code: "board.create-failed",
      cause: expect.objectContaining({ message: "Permission denied" }),
    });
  });

  it("reports an existence-check failure as a create failure", async () => {
    const fileSystem = makeFileSystem({
      exists: vi.fn().mockRejectedValue(new Error("I/O error")),
    });
    const boardRepository = makeBoardRepository();
    const input = {
      directory: "/home/user/boards",
      fileName: "facet.board.yaml",
      name: "My Board",
    };

    const act = () => createBoard(input, { fileSystem, boardRepository });

    await expect(act).rejects.toMatchObject({ code: "board.create-failed" });
  });
});
