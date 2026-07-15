import type { ConfigRepository } from "../domain/configRepository.ts";

export interface ListRecentBoardsDeps {
  configRepository: ConfigRepository;
}

export async function listRecentBoards(
  { configRepository }: ListRecentBoardsDeps,
): Promise<string[]> {
  return (await configRepository.load()).recentBoards;
}
