import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import {
  type DirEntry,
  FileSystemError,
  type FileSystemPort,
} from "../domain/fileSystemPort.ts";
import type { Board } from "../domain/board.ts";
import { YamlBoardRepository } from "./yamlBoardRepository.ts";

class FakeFileSystemPort implements FileSystemPort {
  private readonly files: Map<string, string>;
  private readonly readErrors: Map<string, Error>;
  readonly writes: Array<{ path: string; content: string }> = [];
  // Recorded separately from writes so tests can assert which API was used:
  // create must go through the exclusive createTextFile, never writeTextFile.
  readonly creates: Array<{ path: string; content: string }> = [];

  constructor(
    files: Record<string, string> = {},
    readErrors: Record<string, Error> = {},
  ) {
    this.files = new Map(Object.entries(files));
    this.readErrors = new Map(Object.entries(readErrors));
  }

  removeFile(): Promise<void> {
    throw new Error("not needed for this test");
  }

  readDir(): Promise<DirEntry[]> {
    throw new Error("not needed for this test");
  }

  homeDirectory(): Promise<string> {
    throw new Error("not needed for this test");
  }

  readTextFile(path: string): Promise<string> {
    const readError = this.readErrors.get(path);
    if (readError) return Promise.reject(readError);
    const content = this.files.get(path);
    if (content === undefined) {
      return Promise.reject(
        new FileSystemError("not-found", "read-file", path),
      );
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
      labels: [],
      columns: [
        {
          id: "doing",
          name: "Doing",
          cards: [
            {
              path: "improve-search.md",
              absolutePath: "/board/improve-search.md",
              fileState: "available",
              priority: "high",
              labels: ["search"],
              displayTitle: "Improve search",
            },
          ],
        },
      ],
    });
  });

  it("loads the label registry", async () => {
    const fileSystem = new FakeFileSystemPort({
      "/board/development.board.yaml": `
version: 1
name: Development
labels:
  - name: ui
    color: ruby
columns: []
`,
    });
    const repository = new YamlBoardRepository(fileSystem);

    const board = await repository.load("/board/development.board.yaml");

    expect(board.labels).toEqual([{ name: "ui", color: "ruby" }]);
  });

  it("defaults to an empty label registry when board.yaml predates the labels key", async () => {
    const fileSystem = new FakeFileSystemPort({
      "/board/development.board.yaml": `
version: 1
name: Development
columns: []
`,
    });
    const repository = new YamlBoardRepository(fileSystem);

    const board = await repository.load("/board/development.board.yaml");

    expect(board.labels).toEqual([]);
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
    expect(card.fileState).toBe("missing");
  });

  it("keeps loading the rest of the board when one card's markdown cannot be read", async () => {
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
      - path: improve-search.md
        labels: []
`,
      "/board/improve-search.md": "# Improve search",
    });
    const repository = new YamlBoardRepository(fileSystem);

    const board = await repository.load("/board/development.board.yaml");

    expect(board.columns[0].cards.map((card) => card.fileState)).toEqual([
      "missing",
      "available",
    ]);
    expect(board.columns[0].cards[1].displayTitle).toBe("Improve search");
  });

  it("distinguishes an unreadable markdown from a missing one", async () => {
    const unreadablePath = "/board/private.md";
    const fileSystem = new FakeFileSystemPort({
      "/board/development.board.yaml": `
version: 1
name: Development
columns:
  - id: doing
    name: Doing
    cards:
      - path: private.md
        labels: []
`,
    }, {
      [unreadablePath]: new FileSystemError(
        "operation-failed",
        "read-file",
        unreadablePath,
      ),
    });
    const repository = new YamlBoardRepository(fileSystem);

    const board = await repository.load("/board/development.board.yaml");
    const card = board.columns[0].cards[0];

    expect(card.fileState).toBe("unreadable");
    expect(card.absolutePath).toBe(unreadablePath);
    expect(card.displayTitle).toBe("private");
  });

  it("reads an empty markdown file as available", async () => {
    const fileSystem = new FakeFileSystemPort({
      "/board/development.board.yaml": `
version: 1
name: Development
columns:
  - id: doing
    name: Doing
    cards:
      - path: empty.md
        labels: []
`,
      "/board/empty.md": "",
    });
    const repository = new YamlBoardRepository(fileSystem);

    const board = await repository.load("/board/development.board.yaml");

    expect(board.columns[0].cards[0].fileState).toBe("available");
  });

  it("marks cards whose path does not resolve inside the board directory as unresolvable", async () => {
    const fileSystem = new FakeFileSystemPort({
      "/board/development.board.yaml": `
version: 1
name: Development
columns:
  - id: doing
    name: Doing
    cards:
      - path: /Users/someone/notes.md
        labels: []
      - path: ../outside.md
        labels: []
`,
    });
    const repository = new YamlBoardRepository(fileSystem);

    const board = await repository.load("/board/development.board.yaml");

    for (const card of board.columns[0].cards) {
      expect(card.fileState).toBe("unresolvable");
      expect(card.absolutePath).toBeUndefined();
    }
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
      labels: [{ name: "search", color: "sapphire" }],
      columns: [
        {
          id: "doing",
          name: "Doing",
          cards: [
            {
              path: "improve-search.md",
              absolutePath: "/board/improve-search.md",
              // Deliberately not "available": the file state observed while
              // loading must not leak into the saved file.
              fileState: "missing",
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
      labels: [{ name: "search", color: "sapphire" }],
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
  it("writes an empty board with explicit labels/columns keys via exclusive create", async () => {
    const fileSystem = new FakeFileSystemPort();
    const repository = new YamlBoardRepository(fileSystem);
    const board: Board = {
      version: 1,
      name: "New Board",
      labels: [],
      columns: [],
    };

    await repository.create("/board/facet.board.yaml", board);

    expect(fileSystem.writes).toHaveLength(0);
    expect(fileSystem.creates).toHaveLength(1);
    const created = fileSystem.creates[0];
    expect(created.path).toBe("/board/facet.board.yaml");
    expect(parse(created.content)).toEqual({
      version: 1,
      name: "New Board",
      labels: [],
      columns: [],
    });
  });

  it("loads a just-created empty board back unchanged", async () => {
    const fileSystem = new FakeFileSystemPort();
    const repository = new YamlBoardRepository(fileSystem);
    const board: Board = {
      version: 1,
      name: "New Board",
      labels: [],
      columns: [],
    };

    await repository.create("/board/facet.board.yaml", board);
    const result = await repository.load("/board/facet.board.yaml");

    expect(result).toEqual(board);
  });

  it("round-trips a board with a populated label registry", async () => {
    const fileSystem = new FakeFileSystemPort();
    const repository = new YamlBoardRepository(fileSystem);
    const board: Board = {
      version: 1,
      name: "New Board",
      labels: [
        { name: "ui", color: "ruby" },
        { name: "docs", color: "amber" },
      ],
      columns: [],
    };

    await repository.create("/board/facet.board.yaml", board);
    const result = await repository.load("/board/facet.board.yaml");

    expect(result).toEqual(board);
  });
});
