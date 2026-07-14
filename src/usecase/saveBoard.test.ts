import { describe, expect, it } from "vitest";
import type { Board } from "../domain/board.ts";
import type { BoardRepository } from "../domain/boardRepository.ts";
import { saveBoard } from "./saveBoard.ts";

class FakeBoardRepository implements BoardRepository {
  readonly saves: Array<{ path: string; board: Board }> = [];

  load(): Promise<Board> {
    throw new Error("not needed for this test");
  }

  save(path: string, board: Board): Promise<void> {
    this.saves.push({ path, board });
    return Promise.resolve();
  }
}

describe("saveBoard", () => {
  it("saves the board to the given path through the repository", async () => {
    const boardRepository = new FakeBoardRepository();
    const board: Board = { version: 1, name: "Development", columns: [] };

    await saveBoard("/board/development.board.yaml", board, {
      boardRepository,
    });

    expect(boardRepository.saves).toEqual([
      { path: "/board/development.board.yaml", board },
    ]);
  });
});
