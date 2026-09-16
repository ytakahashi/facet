import type { Board } from "./board.ts";
import type { FileRevision } from "./fileSystemPort.ts";

export interface LoadedBoard {
  board: Board;
  revision: FileRevision;
}

export interface BoardRepository {
  load(path: string): Promise<LoadedBoard>;
  save(
    path: string,
    board: Board,
    expectedRevision?: FileRevision,
  ): Promise<FileRevision>;
  // Unlike save, fails when a file already exists at the path. Creation is a
  // separate operation so no caller can overwrite an existing board file by
  // accident.
  create(path: string, board: Board): Promise<void>;
}
