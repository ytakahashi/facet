import { describe, expect, it } from "vitest";
import type { AppConfig } from "../domain/appConfig.ts";
import type { ConfigRepository } from "../domain/configRepository.ts";
import { listRecentBoards } from "./listRecentBoards.ts";

class FakeConfigRepository implements ConfigRepository {
  private readonly config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
  }

  load(): Promise<AppConfig> {
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
});
