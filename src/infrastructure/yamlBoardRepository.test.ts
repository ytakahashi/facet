import { describe, expect, it } from "vitest";
import type { DirEntry, FileSystemPort } from "../domain/fileSystemPort.ts";
import { YamlBoardRepository } from "./yamlBoardRepository.ts";

class FakeFileSystemPort implements FileSystemPort {
  private readonly files: Map<string, string>;

  constructor(files: Record<string, string>) {
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

  writeTextFile(): Promise<void> {
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
