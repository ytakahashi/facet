import type { Board } from "./board.ts";

export interface BoardRepository {
  load(path: string): Promise<Board>;
  save(path: string, board: Board): Promise<void>;
}
