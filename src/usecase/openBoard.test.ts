import { describe, expect, it } from "vitest";
import type { AppConfig } from "../domain/appConfig.ts";
import { emptyAppConfig } from "../domain/appConfig.ts";
import type { Board } from "../domain/board.ts";
import type { BoardRepository } from "../domain/boardRepository.ts";
import type { ConfigRepository } from "../domain/configRepository.ts";
import { openBoard } from "./openBoard.ts";

class FakeBoardRepository implements BoardRepository {
  private readonly board: Board | undefined;
  private loadedPath: string | undefined;

  constructor(board?: Board) {
    this.board = board;
  }

  load(path: string): Promise<Board> {
    this.loadedPath = path;
    if (!this.board) {
      return Promise.reject(new Error(`board not found: ${path}`));
    }
    return Promise.resolve(this.board);
  }

  save(): Promise<void> {
    throw new Error("not needed for this test");
  }

  get requestedPath(): string | undefined {
    return this.loadedPath;
  }
}

class FakeConfigRepository implements ConfigRepository {
  private config: AppConfig;
  private readonly shouldFail: boolean;

  constructor(config: AppConfig = emptyAppConfig(), shouldFail = false) {
    this.config = config;
    this.shouldFail = shouldFail;
  }

  load(): Promise<AppConfig> {
    if (this.shouldFail) {
      return Promise.reject(new Error("config load failed"));
    }
    return Promise.resolve(this.config);
  }

  save(config: AppConfig): Promise<void> {
    if (this.shouldFail) {
      return Promise.reject(new Error("config save failed"));
    }
    this.config = config;
    return Promise.resolve();
  }

  get savedConfig(): AppConfig {
    return this.config;
  }
}

describe("openBoard", () => {
  it("loads the board at the given path through the repository", async () => {
    const board: Board = { version: 1, name: "Development", columns: [] };
    const boardRepository = new FakeBoardRepository(board);
    const configRepository = new FakeConfigRepository();

    const result = await openBoard("/board/development.board.yaml", {
      boardRepository,
      configRepository,
    });

    expect(result).toEqual(board);
    expect(boardRepository.requestedPath).toBe(
      "/board/development.board.yaml",
    );
  });

  it("records the opened path at the front of the recent boards history", async () => {
    const board: Board = { version: 1, name: "Development", columns: [] };
    const boardRepository = new FakeBoardRepository(board);
    const configRepository = new FakeConfigRepository();

    await openBoard("/board/development.board.yaml", {
      boardRepository,
      configRepository,
    });

    expect(configRepository.savedConfig).toEqual({
      version: 1,
      recentBoards: ["/board/development.board.yaml"],
    });
  });

  it("does not touch the config when the board fails to load", async () => {
    const boardRepository = new FakeBoardRepository(undefined);
    const configRepository = new FakeConfigRepository();

    await expect(
      openBoard("/board/missing.board.yaml", {
        boardRepository,
        configRepository,
      }),
    ).rejects.toThrow();
    expect(configRepository.savedConfig).toEqual(emptyAppConfig());
  });

  it("still returns the board when recording history fails", async () => {
    const board: Board = { version: 1, name: "Development", columns: [] };
    const boardRepository = new FakeBoardRepository(board);
    const configRepository = new FakeConfigRepository(emptyAppConfig(), true);

    const result = await openBoard("/board/development.board.yaml", {
      boardRepository,
      configRepository,
    });

    expect(result).toEqual(board);
  });
});
