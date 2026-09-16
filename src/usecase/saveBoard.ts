import type { Board } from "../domain/board.ts";
import type { BoardRepository } from "../domain/boardRepository.ts";
import {
  type FileRevision,
  FileSystemError,
} from "../domain/fileSystemPort.ts";
import { UseCaseError } from "./useCaseError.ts";

export interface SaveBoardDeps {
  boardRepository: BoardRepository;
}

export async function saveBoard(
  path: string,
  board: Board,
  expectedRevision: FileRevision | undefined,
  { boardRepository }: SaveBoardDeps,
): Promise<FileRevision> {
  try {
    return await boardRepository.save(path, board, expectedRevision);
  } catch (cause) {
    if (
      cause instanceof FileSystemError &&
      (cause.kind === "revision-mismatch" || cause.kind === "not-found")
    ) {
      throw new UseCaseError("board.conflict", { path }, { cause });
    }
    throw new UseCaseError("board.save-failed", { path }, { cause });
  }
}
