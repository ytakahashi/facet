import type { Board } from "./board.ts";

export interface BoardRepository {
  load(path: string): Promise<Board>;
  save(path: string, board: Board): Promise<void>;
  // Unlike save, fails when a file already exists at the path. Creation is a
  // separate operation so no caller can overwrite an existing board file by
  // accident.
  create(path: string, board: Board): Promise<void>;
}
