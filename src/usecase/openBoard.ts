import { addRecentBoard } from "../domain/appConfig.ts";
import type { Board } from "../domain/board.ts";
import type { BoardRepository } from "../domain/boardRepository.ts";
import type { ConfigRepository } from "../domain/configRepository.ts";
import { UseCaseError } from "./useCaseError.ts";

export interface OpenBoardDeps {
  boardRepository: BoardRepository;
  configRepository: ConfigRepository;
}

export async function openBoard(
  path: string,
  { boardRepository, configRepository }: OpenBoardDeps,
): Promise<Board> {
  let board: Board;
  try {
    board = await boardRepository.load(path);
  } catch (cause) {
    throw new UseCaseError("board.open-failed", { path }, { cause });
  }

  // History recording must never block opening the board itself: a config
  // read/write failure shouldn't stop the user from seeing the board they
  // just asked to open.
  try {
    const config = await configRepository.load();
    await configRepository.save(addRecentBoard(config, path));
  } catch (error) {
    console.warn("Failed to record board history:", error);
  }

  return board;
}
