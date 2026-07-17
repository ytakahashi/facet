import { describe, expect, it } from "vitest";
import type { AppConfig } from "../domain/appConfig.ts";
import type { ConfigRepository } from "../domain/configRepository.ts";
import { listRecentBoards } from "./listRecentBoards.ts";

class FakeConfigRepository implements ConfigRepository {
  private readonly config: AppConfig;
  private readonly loadError?: Error;

  constructor(config: AppConfig, loadError?: Error) {
    this.config = config;
    this.loadError = loadError;
  }

  load(): Promise<AppConfig> {
    if (this.loadError) return Promise.reject(this.loadError);
    return Promise.resolve(this.config);
  }

  save(): Promise<void> {
    throw new Error("not needed for this test");
  }
}

describe("listRecentBoards", () => {
  it("returns the recent boards from the config", async () => {
    const configRepository = new FakeConfigRepository({
      version: 1,
      recentBoards: ["/boards/a.board.yaml", "/boards/b.board.yaml"],
    });

    const result = await listRecentBoards({ configRepository });

    expect(result).toEqual(["/boards/a.board.yaml", "/boards/b.board.yaml"]);
  });

  it("returns an empty list when there is no history", async () => {
    const configRepository = new FakeConfigRepository({
      version: 1,
      recentBoards: [],
    });

    const result = await listRecentBoards({ configRepository });

    expect(result).toEqual([]);
  });

  it("maps config failures to a recent boards load error", async () => {
    const configRepository = new FakeConfigRepository(
      { version: 1, recentBoards: [] },
      new Error("config unavailable"),
    );

    const act = () => listRecentBoards({ configRepository });

    await expect(act).rejects.toMatchObject({
      code: "recent-boards.load-failed",
    });
  });
});
