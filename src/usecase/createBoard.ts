import { createEmptyBoard } from "../domain/board.ts";
import {
  BoardFileValidationError,
  normalizeBoardName,
  resolveNewBoardPath,
} from "../domain/boardFile.ts";
import type { BoardRepository } from "../domain/boardRepository.ts";
import {
  FileSystemError,
  type FileSystemPort,
} from "../domain/fileSystemPort.ts";
import {
  boardFileValidationToUseCaseError,
  UseCaseError,
} from "./useCaseError.ts";

export interface CreateBoardInput {
  directory: string;
  fileName: string;
  name: string;
}

export interface CreateBoardDeps {
  fileSystem: FileSystemPort;
  boardRepository: BoardRepository;
}

// Returns the absolute path of the created board file. Recording the board
// in the recent history is left to the follow-up openBoard call, which
// already records every opened board; recording here too would write the
// config twice for one user action.
export async function createBoard(
  input: CreateBoardInput,
  { fileSystem, boardRepository }: CreateBoardDeps,
): Promise<string> {
  let name: string;
  let path: ReturnType<typeof resolveNewBoardPath>;
  try {
    name = normalizeBoardName(input.name);
    path = resolveNewBoardPath(input.directory, input.fileName);
  } catch (cause) {
    if (cause instanceof BoardFileValidationError) {
      throw boardFileValidationToUseCaseError(cause);
    }
    throw cause;
  }

  // Early existence check for user feedback; the exclusive create below
  // still guards against a file appearing between check and write.
  let exists: boolean;
  try {
    exists = await fileSystem.exists(path.absolutePath);
  } catch (cause) {
    throw new UseCaseError(
      "board.create-failed",
      { path: path.absolutePath },
      { cause },
    );
  }
  if (exists) {
    throw new UseCaseError("board.file-already-exists", {
      path: path.absolutePath,
    });
  }

  try {
    await boardRepository.create(path.absolutePath, createEmptyBoard(name));
  } catch (cause) {
    if (cause instanceof FileSystemError && cause.kind === "already-exists") {
      throw new UseCaseError(
        "board.file-already-exists",
        { path: path.absolutePath },
        { cause },
      );
    }
    throw new UseCaseError(
      "board.create-failed",
      { path: path.absolutePath },
      { cause },
    );
  }
  return path.absolutePath;
}
