import { parse } from "yaml";
import type { Board, Column } from "../domain/board.ts";
import type { BoardRepository } from "../domain/boardRepository.ts";
import { directoryOf, resolveCardPath } from "../domain/boardPath.ts";
import type { Card } from "../domain/card.ts";
import { resolveCardTitle } from "../domain/card.ts";
import type { FileSystemPort } from "../domain/fileSystemPort.ts";

// Trusts the parsed YAML's shape instead of validating it against a schema.
// A malformed field (wrong type, missing key) surfaces as an odd value
// downstream (e.g. an unexpected string in a typed union) rather than a
// clear parse error. Deliberately out of scope for this phase, which only
// reads boards nobody has written back to yet; revisit once this app can
// write these files itself, since a bug in that path could produce exactly
// this kind of malformed input.
interface RawCard {
  path: string;
  title?: string;
  priority?: string;
  labels?: string[];
}

interface RawColumn {
  id: string;
  name: string;
  cards?: RawCard[];
}

interface RawBoard {
  version: number;
  name: string;
  columns?: RawColumn[];
}

export class YamlBoardRepository implements BoardRepository {
  private readonly fileSystem: FileSystemPort;

  constructor(fileSystem: FileSystemPort) {
    this.fileSystem = fileSystem;
  }

  async load(path: string): Promise<Board> {
    const yamlText = await this.fileSystem.readTextFile(path);
    const raw = parse(yamlText) as RawBoard | null;

    if (!raw || !Array.isArray(raw.columns)) {
      throw new Error(`Invalid board file: ${path}`);
    }

    const boardDirectory = directoryOf(path);
    const columns: Column[] = [];
    for (const rawColumn of raw.columns) {
      const cards: Card[] = [];
      for (const rawCard of rawColumn.cards ?? []) {
        cards.push(await this.loadCard(boardDirectory, rawCard));
      }
      columns.push({ id: rawColumn.id, name: rawColumn.name, cards });
    }

    return { version: raw.version, name: raw.name, columns };
  }

  private async loadCard(
    boardDirectory: string,
    rawCard: RawCard,
  ): Promise<Card> {
    const resolved = resolveCardPath(boardDirectory, rawCard.path);
    const markdownText = resolved.ok
      ? await this.tryReadTextFile(resolved.absolutePath)
      : undefined;

    return {
      path: rawCard.path,
      absolutePath: resolved.ok ? resolved.absolutePath : undefined,
      titleOverride: rawCard.title,
      priority: rawCard.priority as Card["priority"],
      labels: rawCard.labels ?? [],
      displayTitle: resolveCardTitle(
        rawCard.title,
        markdownText,
        rawCard.path,
      ),
    };
  }

  private async tryReadTextFile(path: string): Promise<string | undefined> {
    try {
      return await this.fileSystem.readTextFile(path);
    } catch {
      return undefined;
    }
  }
}
