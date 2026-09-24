import { describe, expect, it } from "vitest";
import type { AppConfig } from "./appConfig.ts";
import {
  addRecentBoard,
  emptyAppConfig,
  removeRecentBoard,
} from "./appConfig.ts";

function makeConfig(overrides?: Partial<AppConfig>): AppConfig {
  return { version: 1, recentBoards: [], ...overrides };
}

describe("addRecentBoard", () => {
  it("adds the path to the front of an empty config", () => {
    const config = emptyAppConfig();

    const result = addRecentBoard(config, "/boards/a.board.yaml");

    expect(result).toEqual(
      makeConfig({ recentBoards: ["/boards/a.board.yaml"] }),
    );
  });

  it("inserts the new path at the front, pushing existing entries back", () => {
    const config = makeConfig({
      recentBoards: ["/boards/a.board.yaml", "/boards/b.board.yaml"],
    });

    const result = addRecentBoard(config, "/boards/c.board.yaml");

    expect(result).toEqual(makeConfig({
      recentBoards: [
        "/boards/c.board.yaml",
        "/boards/a.board.yaml",
        "/boards/b.board.yaml",
      ],
    }));
  });

  it("moves an already-recorded path to the front instead of duplicating it", () => {
    const config = makeConfig({
      recentBoards: [
        "/boards/a.board.yaml",
        "/boards/b.board.yaml",
        "/boards/c.board.yaml",
      ],
    });

    const result = addRecentBoard(config, "/boards/b.board.yaml");

    expect(result).toEqual(makeConfig({
      recentBoards: [
        "/boards/b.board.yaml",
        "/boards/a.board.yaml",
        "/boards/c.board.yaml",
      ],
    }));
  });

  it("truncates the list at the maximum of 10 entries", () => {
    const existing = Array.from(
      { length: 10 },
      (_, i) => `/boards/${i}.board.yaml`,
    );
    const config = makeConfig({ recentBoards: existing });

    const result = addRecentBoard(config, "/boards/new.board.yaml");

    expect(result.recentBoards).toHaveLength(10);
    expect(result.recentBoards[0]).toBe("/boards/new.board.yaml");
    expect(result.recentBoards).not.toContain("/boards/9.board.yaml");
  });
});

describe("removeRecentBoard", () => {
  it("removes the path and keeps the order of the rest", () => {
    const config = makeConfig({
      recentBoards: [
        "/boards/a.board.yaml",
        "/boards/b.board.yaml",
        "/boards/c.board.yaml",
      ],
    });

    const result = removeRecentBoard(config, "/boards/b.board.yaml");

    expect(result).toEqual(makeConfig({
      recentBoards: ["/boards/a.board.yaml", "/boards/c.board.yaml"],
    }));
  });

  it("leaves the list unchanged when the path is not recorded", () => {
    const config = makeConfig({ recentBoards: ["/boards/a.board.yaml"] });

    const result = removeRecentBoard(config, "/boards/b.board.yaml");

    expect(result).toEqual(config);
  });
});
