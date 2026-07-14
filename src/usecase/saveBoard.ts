import type { Board } from "../domain/board.ts";
import type { BoardRepository } from "../domain/boardRepository.ts";

export interface SaveBoardDeps {
  boardRepository: BoardRepository;
}

export function saveBoard(
  path: string,
  board: Board,
  { boardRepository }: SaveBoardDeps,
): Promise<void> {
  return boardRepository.save(path, board);
}
