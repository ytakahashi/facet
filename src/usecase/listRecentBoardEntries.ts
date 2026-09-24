import type { BoardRepository } from "../domain/boardRepository.ts";
import type { ConfigRepository } from "../domain/configRepository.ts";
import { FileSystemError } from "../domain/fileSystemPort.ts";
import { listRecentBoards } from "./listRecentBoards.ts";

export type RecentBoardEntry =
  | { path: string; status: "available"; name: string }
  | { path: string; status: "missing" }
  | { path: string; status: "unreadable" };

export interface ListRecentBoardEntriesDeps {
  configRepository: ConfigRepository;
  boardRepository: Pick<BoardRepository, "loadName">;
}

// Reads each board's name from its file every time rather than keeping a copy
// in the config, which would go stale whenever a board is renamed or edited
// outside Facet. A board that cannot be read becomes an entry of its own
// instead of failing the list, so the user can still see and remove it.
export async function listRecentBoardEntries(
  { configRepository, boardRepository }: ListRecentBoardEntriesDeps,
): Promise<RecentBoardEntry[]> {
  const paths = await listRecentBoards({ configRepository });
  return Promise.all(
    paths.map(async (path): Promise<RecentBoardEntry> => {
      try {
        const name = await boardRepository.loadName(path);
        return { path, status: "available", name };
      } catch (cause) {
        return cause instanceof FileSystemError && cause.kind === "not-found"
          ? { path, status: "missing" }
          : { path, status: "unreadable" };
      }
    }),
  );
}
