import type { Board } from "../domain/board.ts";
import type { BoardRepository } from "../domain/boardRepository.ts";
import { UseCaseError } from "./useCaseError.ts";

export interface SaveBoardDeps {
  boardRepository: BoardRepository;
}

export async function saveBoard(
  path: string,
  board: Board,
  { boardRepository }: SaveBoardDeps,
): Promise<void> {
  try {
    await boardRepository.save(path, board);
  } catch (cause) {
    throw new UseCaseError("board.save-failed", { path }, { cause });
  }
}
