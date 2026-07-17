import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import type { DirEntry, FileSystemPort } from "../domain/fileSystemPort.ts";
import { YamlConfigRepository } from "./yamlConfigRepository.ts";

const CONFIG_PATH = "/Users/test/Library/Application Support/Facet/config.yaml";

class FakeFileSystemPort implements FileSystemPort {
  private readonly files: Map<string, string>;
  readonly mkdirCalls: string[] = [];

  constructor(files: Record<string, string> = {}) {
    this.files = new Map(Object.entries(files));
  }

  readDir(): Promise<DirEntry[]> {
    throw new Error("not needed for this test");
  }

  homeDirectory(): Promise<string> {
    return Promise.resolve("/Users/test");
  }

  readTextFile(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) {
      return Promise.reject(new Error(`file not found: ${path}`));
    }
    return Promise.resolve(content);
  }

  writeTextFile(path: string, content: string): Promise<void> {
    this.files.set(path, content);
    return Promise.resolve();
  }

  createTextFile(): Promise<void> {
    throw new Error("not needed for this test");
  }

  exists(path: string): Promise<boolean> {
    return Promise.resolve(this.files.has(path));
  }

  mkdir(path: string): Promise<void> {
    this.mkdirCalls.push(path);
    return Promise.resolve();
  }
}

describe("YamlConfigRepository.load", () => {
  it("returns an empty config when the file does not exist", async () => {
    const fileSystem = new FakeFileSystemPort();
    const repository = new YamlConfigRepository(fileSystem);

    const result = await repository.load();

    expect(result).toEqual({ version: 1, recentBoards: [] });
  });

  it("parses an existing config file", async () => {
    const fileSystem = new FakeFileSystemPort({
      [CONFIG_PATH]: "version: 1\nrecentBoards:\n  - /boards/a.board.yaml\n",
    });
    const repository = new YamlConfigRepository(fileSystem);

    const result = await repository.load();

    expect(result).toEqual({
      version: 1,
      recentBoards: ["/boards/a.board.yaml"],
    });
  });

  it("falls back to an empty config when the file is malformed", async () => {
    const fileSystem = new FakeFileSystemPort({
      [CONFIG_PATH]: "not: [valid, yaml:",
    });
    const repository = new YamlConfigRepository(fileSystem);

    const result = await repository.load();

    expect(result).toEqual({ version: 1, recentBoards: [] });
  });

  it("falls back to an empty config when recentBoards is missing", async () => {
    const fileSystem = new FakeFileSystemPort({
      [CONFIG_PATH]: "version: 1\n",
    });
    const repository = new YamlConfigRepository(fileSystem);

    const result = await repository.load();

    expect(result).toEqual({ version: 1, recentBoards: [] });
  });
});

describe("YamlConfigRepository.save", () => {
  it("creates the config directory before writing", async () => {
    const fileSystem = new FakeFileSystemPort();
    const repository = new YamlConfigRepository(fileSystem);

    await repository.save({
      version: 1,
      recentBoards: ["/boards/a.board.yaml"],
    });

    expect(fileSystem.mkdirCalls).toEqual([
      "/Users/test/Library/Application Support/Facet",
    ]);
  });

  it("writes a config that round-trips through load", async () => {
    const fileSystem = new FakeFileSystemPort();
    const repository = new YamlConfigRepository(fileSystem);
    const config = {
      version: 1 as const,
      recentBoards: ["/boards/a.board.yaml"],
    };

    await repository.save(config);
    const result = await repository.load();

    expect(result).toEqual(config);
  });

  it("writes valid YAML containing the given fields", async () => {
    const fileSystem = new FakeFileSystemPort();
    const repository = new YamlConfigRepository(fileSystem);

    await repository.save({
      version: 1,
      recentBoards: ["/boards/a.board.yaml"],
    });

    const written = await fileSystem.readTextFile(CONFIG_PATH);
    expect(parse(written)).toEqual({
      version: 1,
      recentBoards: ["/boards/a.board.yaml"],
    });
  });
});
