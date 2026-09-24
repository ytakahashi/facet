import { describe, expect, it } from "vitest";
import type { AppConfig } from "../domain/appConfig.ts";
import type { ConfigRepository } from "../domain/configRepository.ts";
import { removeRecentBoard } from "./removeRecentBoard.ts";

class FakeConfigRepository implements ConfigRepository {
  config: AppConfig;
  private readonly saveError?: Error;

  constructor(config: AppConfig, saveError?: Error) {
    this.config = config;
    this.saveError = saveError;
  }

  load(): Promise<AppConfig> {
    return Promise.resolve(this.config);
  }

  save(config: AppConfig): Promise<void> {
    if (this.saveError) return Promise.reject(this.saveError);
    this.config = config;
    return Promise.resolve();
  }
}

describe("removeRecentBoard", () => {
  it("saves the config without the removed path", async () => {
    const configRepository = new FakeConfigRepository({
      version: 1,
      recentBoards: ["/boards/a.board.yaml", "/boards/b.board.yaml"],
    });

    await removeRecentBoard("/boards/a.board.yaml", { configRepository });

    expect(configRepository.config.recentBoards).toEqual([
      "/boards/b.board.yaml",
    ]);
  });

  it("maps config failures to a recent board removal error", async () => {
    const cause = new Error("disk full");
    const configRepository = new FakeConfigRepository(
      { version: 1, recentBoards: ["/boards/a.board.yaml"] },
      cause,
    );

    const act = () =>
      removeRecentBoard("/boards/a.board.yaml", { configRepository });

    await expect(act).rejects.toMatchObject({
      code: "recent-boards.remove-failed",
      details: { path: "/boards/a.board.yaml" },
      cause,
    });
  });
});
