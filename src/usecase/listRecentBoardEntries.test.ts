import { describe, expect, it } from "vitest";
import type { AppConfig } from "../domain/appConfig.ts";
import type { BoardRepository } from "../domain/boardRepository.ts";
import type { ConfigRepository } from "../domain/configRepository.ts";
import { FileSystemError } from "../domain/fileSystemPort.ts";
import { listRecentBoardEntries } from "./listRecentBoardEntries.ts";

class FakeConfigRepository implements ConfigRepository {
  private readonly config: AppConfig;

  constructor(recentBoards: string[]) {
    this.config = { version: 1, recentBoards };
  }

  load(): Promise<AppConfig> {
    return Promise.resolve(this.config);
  }

  save(): Promise<void> {
    throw new Error("not needed for this test");
  }
}

// Maps a path to the board name it holds, or to the error reading it raises.
function makeBoardRepository(
  results: Record<string, string | Error>,
): Pick<BoardRepository, "loadName"> {
  return {
    loadName: (path) => {
      const result = results[path];
      return result instanceof Error
        ? Promise.reject(result)
        : Promise.resolve(result);
    },
  };
}

describe("listRecentBoardEntries", () => {
  it("pairs each recent path with the name read from its board file, in order", async () => {
    const configRepository = new FakeConfigRepository([
      "/boards/b.board.yaml",
      "/boards/a.board.yaml",
    ]);
    const boardRepository = makeBoardRepository({
      "/boards/a.board.yaml": "Alpha",
      "/boards/b.board.yaml": "Beta",
    });

    const result = await listRecentBoardEntries({
      configRepository,
      boardRepository,
    });

    expect(result).toEqual([
      { path: "/boards/b.board.yaml", status: "available", name: "Beta" },
      { path: "/boards/a.board.yaml", status: "available", name: "Alpha" },
    ]);
  });

  it("keeps boards that cannot be read, telling a missing file from an unreadable one", async () => {
    const configRepository = new FakeConfigRepository([
      "/boards/a.board.yaml",
      "/boards/gone.board.yaml",
      "/boards/broken.board.yaml",
    ]);
    const boardRepository = makeBoardRepository({
      "/boards/a.board.yaml": "Alpha",
      "/boards/gone.board.yaml": new FileSystemError(
        "not-found",
        "read-file",
        "/boards/gone.board.yaml",
      ),
      "/boards/broken.board.yaml": new Error("Invalid board file"),
    });

    const result = await listRecentBoardEntries({
      configRepository,
      boardRepository,
    });

    expect(result).toEqual([
      { path: "/boards/a.board.yaml", status: "available", name: "Alpha" },
      { path: "/boards/gone.board.yaml", status: "missing" },
      { path: "/boards/broken.board.yaml", status: "unreadable" },
    ]);
  });
});
