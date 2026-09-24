import { removeRecentBoard as removeRecentBoardFromConfig } from "../domain/appConfig.ts";
import type { ConfigRepository } from "../domain/configRepository.ts";
import { UseCaseError } from "./useCaseError.ts";

export interface RemoveRecentBoardDeps {
  configRepository: ConfigRepository;
}

// Only forgets the path; the board file itself is left alone.
//
// Unlike recording history in openBoard, a failure here is reported: removing
// is what the user asked for, so silently keeping the entry would look like
// the click did nothing.
export async function removeRecentBoard(
  path: string,
  { configRepository }: RemoveRecentBoardDeps,
): Promise<void> {
  try {
    const config = await configRepository.load();
    await configRepository.save(removeRecentBoardFromConfig(config, path));
  } catch (cause) {
    throw new UseCaseError("recent-boards.remove-failed", { path }, { cause });
  }
}
