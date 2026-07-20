import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import type { DirEntry, FileSystemPort } from "../domain/fileSystemPort.ts";
import type { Board } from "../domain/board.ts";
import { YamlBoardRepository } from "./yamlBoardRepository.ts";

class FakeFileSystemPort implements FileSystemPort {
  private readonly files: Map<string, string>;
  readonly writes: Array<{ path: string; content: string }> = [];
  // Recorded separately from writes so tests can assert which API was used:
  // create must go through the exclusive createTextFile, never writeTextFile.
  readonly creates: Array<{ path: string; content: string }> = [];

  constructor(files: Record<string, string> = {}) {
    this.files = new Map(Object.entries(files));
  }

  readDir(): Promise<DirEntry[]> {
    throw new Error("not needed for this test");
  }

  homeDirectory(): Promise<string> {
    throw new Error("not needed for this test");
  }

  readTextFile(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) {
      return Promise.reject(new Error(`file not found: ${path}`));
    }
    return Promise.resolve(content);
  }

  writeTextFile(path: string, content: string): Promise<void> {
    this.writes.push({ path, content });
    return Promise.resolve();
  }

  createTextFile(path: string, content: string): Promise<void> {
    this.creates.push({ path, content });
    this.files.set(path, content);
    return Promise.resolve();
  }

  exists(): Promise<boolean> {
    throw new Error("not needed for this test");
  }

  mkdir(): Promise<void> {
    throw new Error("not needed for this test");
  }
}

describe("YamlBoardRepository", () => {
  it("loads columns and cards with titles resolved from the first H1", async () => {
    const fileSystem = new FakeFileSystemPort({
      "/board/development.board.yaml": `
version: 1
name: Development
columns:
  - id: doing
    name: Doing
    cards:
      - path: improve-search.md
        priority: high
        labels: [search]
`,
      "/board/improve-search.md": "# Improve search\n\nDetails.",
    });
    const repository = new YamlBoardRepository(fileSystem);

    const board = await repository.load("/board/development.board.yaml");

    expect(board).toEqual({
      version: 1,
      name: "Development",
      columns: [
        {
          id: "doing",
          name: "Doing",
          cards: [
            {
              path: "improve-search.md",
              absolutePath: "/board/improve-search.md",
              priority: "high",
              labels: ["search"],
              displayTitle: "Improve search",
            },
          ],
        },
      ],
    });
  });

  it("falls back to the filename when the referenced markdown is missing", async () => {
    const fileSystem = new FakeFileSystemPort({
      "/board/development.board.yaml": `
version: 1
name: Development
columns:
  - id: doing
    name: Doing
    cards:
      - path: missing-card.md
        labels: []
`,
    });
    const repository = new YamlBoardRepository(fileSystem);

    const board = await repository.load("/board/development.board.yaml");
    const card = board.columns[0].cards[0];

    expect(card.displayTitle).toBe("missing-card");
    expect(card.absolutePath).toBe("/board/missing-card.md");
  });

  it("uses the YAML title override even when the markdown has a different H1", async () => {
    const fileSystem = new FakeFileSystemPort({
      "/board/development.board.yaml": `
version: 1
name: Development
columns:
  - id: doing
    name: Doing
    cards:
      - path: improve-search.md
        title: Custom title
        labels: []
`,
      "/board/improve-search.md": "# Improve search",
    });
    const repository = new YamlBoardRepository(fileSystem);

    const board = await repository.load("/board/development.board.yaml");

    expect(board.columns[0].cards[0].displayTitle).toBe("Custom title");
  });
});

describe("YamlBoardRepository.save", () => {
  it("writes the board as YAML, dropping derived fields", async () => {
    const fileSystem = new FakeFileSystemPort();
    const repository = new YamlBoardRepository(fileSystem);
    const board: Board = {
      version: 1,
      name: "Development",
      columns: [
        {
          id: "doing",
          name: "Doing",
          cards: [
            {
              path: "improve-search.md",
              absolutePath: "/board/improve-search.md",
              titleOverride: "Custom title",
              priority: "high",
              labels: ["search"],
              displayTitle: "Custom title",
            },
          ],
        },
      ],
    };

    await repository.save("/board/development.board.yaml", board);

    expect(fileSystem.writes).toHaveLength(1);
    const written = fileSystem.writes[0];
    expect(written.path).toBe("/board/development.board.yaml");
    expect(parse(written.content)).toEqual({
      version: 1,
      name: "Development",
      columns: [
        {
          id: "doing",
          name: "Doing",
          cards: [
            {
              path: "improve-search.md",
              title: "Custom title",
              priority: "high",
              labels: ["search"],
            },
          ],
        },
      ],
    });
  });
});

describe("YamlBoardRepository.create", () => {
  it("writes an empty board with an explicit columns key via exclusive create", async () => {
    const fileSystem = new FakeFileSystemPort();
    const repository = new YamlBoardRepository(fileSystem);
    const board: Board = { version: 1, name: "New Board", columns: [] };

    await repository.create("/board/facet.board.yaml", board);

    expect(fileSystem.writes).toHaveLength(0);
    expect(fileSystem.creates).toHaveLength(1);
    const created = fileSystem.creates[0];
    expect(created.path).toBe("/board/facet.board.yaml");
    expect(parse(created.content)).toEqual({
      version: 1,
      name: "New Board",
      columns: [],
    });
  });

  it("loads a just-created empty board back unchanged", async () => {
    const fileSystem = new FakeFileSystemPort();
    const repository = new YamlBoardRepository(fileSystem);
    const board: Board = { version: 1, name: "New Board", columns: [] };

    await repository.create("/board/facet.board.yaml", board);
    const result = await repository.load("/board/facet.board.yaml");

    expect(result).toEqual(board);
  });
});
