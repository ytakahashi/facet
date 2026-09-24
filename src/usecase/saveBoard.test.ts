import { describe, expect, it } from "vitest";
import type { Board } from "../domain/board.ts";
import type { BoardRepository } from "../domain/boardRepository.ts";
import { FileSystemError } from "../domain/fileSystemPort.ts";
import { saveBoard } from "./saveBoard.ts";

class FakeBoardRepository implements BoardRepository {
  readonly saves: Array<{
    path: string;
    board: Board;
    expectedRevision?: string;
  }> = [];

  load(): ReturnType<BoardRepository["load"]> {
    throw new Error("not needed for this test");
  }

  loadName(): Promise<string> {
    throw new Error("not needed for this test");
  }

  save(
    path: string,
    board: Board,
    expectedRevision?: string,
  ): Promise<string> {
    this.saves.push({ path, board, expectedRevision });
    return Promise.resolve("revision-2");
  }

  create(): Promise<void> {
    throw new Error("not needed for this test");
  }
}

describe("saveBoard", () => {
  it("saves the board to the given path through the repository", async () => {
    const boardRepository = new FakeBoardRepository();
    const board: Board = {
      version: 1,
      name: "Development",
      labels: [],
      columns: [],
    };

    const revision = await saveBoard(
      "/board/development.board.yaml",
      board,
      "revision-1",
      { boardRepository },
    );

    expect(boardRepository.saves).toEqual([
      {
        path: "/board/development.board.yaml",
        board,
        expectedRevision: "revision-1",
      },
    ]);
    expect(revision).toBe("revision-2");
  });

  it("maps repository failures to a board save error", async () => {
    const cause = new Error("disk full");
    const boardRepository: BoardRepository = {
      load: () => Promise.reject(new Error("not needed for this test")),
      loadName: () => Promise.reject(new Error("not needed for this test")),
      save: () => Promise.reject(cause),
      create: () => Promise.reject(new Error("not needed for this test")),
    };
    const board: Board = {
      version: 1,
      name: "Development",
      labels: [],
      columns: [],
    };

    const act = () =>
      saveBoard(
        "/board/development.board.yaml",
        board,
        "revision-1",
        { boardRepository },
      );

    await expect(act).rejects.toMatchObject({
      code: "board.save-failed",
      details: { path: "/board/development.board.yaml" },
      cause,
    });
  });

  for (const kind of ["revision-mismatch", "not-found"] as const) {
    it(`maps ${kind} to a board conflict`, async () => {
      const cause = new FileSystemError(
        kind,
        "write-file",
        "/board/development.board.yaml",
      );
      const boardRepository: BoardRepository = {
        load: () => Promise.reject(new Error("not needed for this test")),
        loadName: () => Promise.reject(new Error("not needed for this test")),
        save: () => Promise.reject(cause),
        create: () => Promise.reject(new Error("not needed for this test")),
      };

      const act = () =>
        saveBoard(
          "/board/development.board.yaml",
          { version: 1, name: "Development", labels: [], columns: [] },
          "revision-1",
          { boardRepository },
        );

      await expect(act).rejects.toMatchObject({
        code: "board.conflict",
        details: { path: "/board/development.board.yaml" },
        cause,
      });
    });
  }
});
