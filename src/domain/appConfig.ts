export const MAX_RECENT_BOARDS = 10;

export interface AppConfig {
  version: 1;
  recentBoards: string[];
}

export function emptyAppConfig(): AppConfig {
  return { version: 1, recentBoards: [] };
}

export function addRecentBoard(config: AppConfig, path: string): AppConfig {
  const deduped = config.recentBoards.filter((entry) => entry !== path);
  return {
    ...config,
    recentBoards: [path, ...deduped].slice(0, MAX_RECENT_BOARDS),
  };
}

export function removeRecentBoard(config: AppConfig, path: string): AppConfig {
  return {
    ...config,
    recentBoards: config.recentBoards.filter((entry) => entry !== path),
  };
}
