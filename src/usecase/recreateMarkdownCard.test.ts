import { describe, expect, it, vi } from "vitest";
import type { Card } from "../domain/card.ts";
import {
  FileSystemError,
  type FileSystemPort,
} from "../domain/fileSystemPort.ts";
import { recreateMarkdownCard } from "./recreateMarkdownCard.ts";

function makeFileSystem(
  overrides: Partial<FileSystemPort> = {},
): FileSystemPort {
  return {
    readTextFile: vi.fn(),
    writeTextFile: vi.fn(),
    removeFile: vi.fn(),
    createTextFile: vi.fn().mockResolvedValue(undefined),
    readDir: vi.fn(),
    homeDirectory: vi.fn(),
    exists: vi.fn().mockResolvedValue(false),
    mkdir: vi.fn(),
    ...overrides,
  };
}

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    path: "gone.md",
    absolutePath: "/board/gone.md",
    fileState: "missing",
    priority: "high",
    labels: ["search"],
    displayTitle: "gone",
    ...overrides,
  };
}

describe("recreateMarkdownCard", () => {
  it("writes the missing file and returns the card pointed at it", async () => {
    const createTextFile = vi.fn().mockResolvedValue(undefined);
    const fileSystem = makeFileSystem({ createTextFile });

    const result = await recreateMarkdownCard({
      boardPath: "/board/development.board.yaml",
      card: makeCard(),
      absolutePath: "/board/gone.md",
      title: "Back again",
    }, { fileSystem });

    expect(createTextFile).toHaveBeenCalledWith(
      "/board/gone.md",
      "# Back again\n\n",
    );
    expect(result).toEqual({
      path: "gone.md",
      absolutePath: "/board/gone.md",
      fileState: "available",
      priority: "high",
      labels: ["search"],
      displayTitle: "Back again",
    });
  });

  it("keeps a title override as the card's displayed title", async () => {
    const fileSystem = makeFileSystem();

    const result = await recreateMarkdownCard({
      boardPath: "/board/development.board.yaml",
      card: makeCard({ titleOverride: "Custom title" }),
      absolutePath: "/board/gone.md",
      title: "Back again",
    }, { fileSystem });

    expect(result.displayTitle).toBe("Custom title");
  });

  it("writes the file at a path the card did not have before", async () => {
    const createTextFile = vi.fn().mockResolvedValue(undefined);
    const fileSystem = makeFileSystem({ createTextFile });

    const result = await recreateMarkdownCard({
      boardPath: "/board/development.board.yaml",
      card: makeCard(),
      absolutePath: "/board/ideas/fresh.md",
      title: "Fresh",
    }, { fileSystem });

    expect(createTextFile).toHaveBeenCalledWith(
      "/board/ideas/fresh.md",
      "# Fresh\n\n",
    );
    expect(result.path).toBe("ideas/fresh.md");
  });

  it("refuses to overwrite a file that is already there", async () => {
    const createTextFile = vi.fn();
    const fileSystem = makeFileSystem({
      exists: vi.fn().mockResolvedValue(true),
      createTextFile,
    });

    const act = () =>
      recreateMarkdownCard({
        boardPath: "/board/development.board.yaml",
        card: makeCard(),
        absolutePath: "/board/gone.md",
        title: "Back again",
      }, { fileSystem });

    await expect(act).rejects.toMatchObject({
      code: "card.file-already-exists",
      details: { path: "/board/gone.md" },
    });
    expect(createTextFile).not.toHaveBeenCalled();
  });

  it("reports a file that appears between the check and the write", async () => {
    const cause = new FileSystemError(
      "already-exists",
      "create-file",
      "/board/gone.md",
    );
    const fileSystem = makeFileSystem({
      createTextFile: vi.fn().mockRejectedValue(cause),
    });

    const act = () =>
      recreateMarkdownCard({
        boardPath: "/board/development.board.yaml",
        card: makeCard(),
        absolutePath: "/board/gone.md",
        title: "Back again",
      }, { fileSystem });

    await expect(act).rejects.toMatchObject({
      code: "card.file-already-exists",
      cause,
    });
  });

  it("rejects a path outside the board directory before writing", async () => {
    const createTextFile = vi.fn();
    const fileSystem = makeFileSystem({ createTextFile });

    const act = () =>
      recreateMarkdownCard({
        boardPath: "/board/development.board.yaml",
        card: makeCard(),
        absolutePath: "/other/gone.md",
        title: "Back again",
      }, { fileSystem });

    await expect(act).rejects.toMatchObject({
      code: "card.outside-board-directory",
    });
    expect(createTextFile).not.toHaveBeenCalled();
  });

  it("rejects a blank title before writing", async () => {
    const createTextFile = vi.fn();
    const fileSystem = makeFileSystem({ createTextFile });

    const act = () =>
      recreateMarkdownCard({
        boardPath: "/board/development.board.yaml",
        card: makeCard(),
        absolutePath: "/board/gone.md",
        title: "   ",
      }, { fileSystem });

    await expect(act).rejects.toMatchObject({ code: "card.title-required" });
    expect(createTextFile).not.toHaveBeenCalled();
  });

  it("maps a failed write with the target path", async () => {
    const cause = new Error("Permission denied");
    const fileSystem = makeFileSystem({
      createTextFile: vi.fn().mockRejectedValue(cause),
    });

    const act = () =>
      recreateMarkdownCard({
        boardPath: "/board/development.board.yaml",
        card: makeCard(),
        absolutePath: "/board/gone.md",
        title: "Back again",
      }, { fileSystem });

    await expect(act).rejects.toMatchObject({
      code: "card.create-failed",
      details: { path: "/board/gone.md" },
      cause,
    });
  });
});
