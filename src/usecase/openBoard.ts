import type { Board } from "../domain/board.ts";
import type { BoardRepository } from "../domain/boardRepository.ts";

export interface OpenBoardDeps {
  boardRepository: BoardRepository;
}

export function openBoard(
  path: string,
  { boardRepository }: OpenBoardDeps,
): Promise<Board> {
  return boardRepository.load(path);
}
