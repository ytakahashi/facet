import { describe, expect, it } from "vitest";
import type { Board } from "../domain/board.ts";
import type { BoardRepository } from "../domain/boardRepository.ts";
import { openBoard } from "./openBoard.ts";

class FakeBoardRepository implements BoardRepository {
  private readonly board: Board;
  private loadedPath: string | undefined;

  constructor(board: Board) {
    this.board = board;
  }

  load(path: string): Promise<Board> {
    this.loadedPath = path;
    return Promise.resolve(this.board);
  }

  get requestedPath(): string | undefined {
    return this.loadedPath;
  }
}

describe("openBoard", () => {
  it("loads the board at the given path through the repository", async () => {
    const board: Board = { version: 1, name: "Development", columns: [] };
    const boardRepository = new FakeBoardRepository(board);

    const result = await openBoard("/board/development.board.yaml", {
      boardRepository,
    });

    expect(result).toEqual(board);
    expect(boardRepository.requestedPath).toBe(
      "/board/development.board.yaml",
    );
  });
});
