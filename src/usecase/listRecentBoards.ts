import type { ConfigRepository } from "../domain/configRepository.ts";
import { UseCaseError } from "./useCaseError.ts";

export interface ListRecentBoardsDeps {
  configRepository: ConfigRepository;
}

export async function listRecentBoards(
  { configRepository }: ListRecentBoardsDeps,
): Promise<string[]> {
  try {
    return (await configRepository.load()).recentBoards;
  } catch (cause) {
    throw new UseCaseError("recent-boards.load-failed", {}, { cause });
  }
}
