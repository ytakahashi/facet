import { parse, stringify } from "yaml";
import type { Board, Column } from "../domain/board.ts";
import type {
  BoardRepository,
  LoadedBoard,
} from "../domain/boardRepository.ts";
import { directoryOf, resolveCardPath } from "../domain/boardPath.ts";
import type { Card } from "../domain/card.ts";
import { resolveCardTitle } from "../domain/card.ts";
import {
  type FileRevision,
  FileSystemError,
  type FileSystemPort,
} from "../domain/fileSystemPort.ts";
import type { LabelColor, LabelDefinition } from "../domain/label.ts";

// Trusts the parsed YAML's shape instead of validating it against a schema:
// beyond load()'s check that `columns` is an array, a malformed field (wrong
// type, missing key) surfaces as an odd value downstream (e.g. an unexpected
// string in a typed union) rather than as a clear parse error.
//
// save() and create() write these files through toRaw(), so the shape holds
// for boards this app produced. What stays unchecked is a hand-edited file -
// and a board this app wrote through a bug in toRaw(), which would then be
// read back without complaint.
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

interface RawLabelDefinition {
  name: string;
  color: string;
}

interface RawBoard {
  version: number;
  name: string;
  labels?: RawLabelDefinition[];
  columns?: RawColumn[];
}

export class YamlBoardRepository implements BoardRepository {
  private readonly fileSystem: FileSystemPort;

  constructor(fileSystem: FileSystemPort) {
    this.fileSystem = fileSystem;
  }

  async load(path: string): Promise<LoadedBoard> {
    const { content, revision } = await this.fileSystem
      .readTextFileWithRevision(path);
    const raw = parse(content) as RawBoard | null;

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
    // Unlike `columns`, a missing `labels` key does not reject the file:
    // board.yaml files written before this key existed must keep loading.
    const labels: LabelDefinition[] = (raw.labels ?? []).map((rawLabel) => ({
      name: rawLabel.name,
      color: rawLabel.color as LabelColor,
    }));

    return {
      board: { version: raw.version, name: raw.name, labels, columns },
      revision,
    };
  }

  private async loadCard(
    boardDirectory: string,
    rawCard: RawCard,
  ): Promise<Card> {
    const resolved = resolveCardPath(boardDirectory, rawCard.path);
    // One unreadable card must not stop the whole board from loading, but a
    // missing file and a file that exists but cannot be read offer different
    // recovery actions in the UI.
    const readResult = resolved.ok
      ? await this.tryReadTextFile(resolved.absolutePath)
      : undefined;
    const markdownText = readResult?.markdownText;

    return {
      path: rawCard.path,
      absolutePath: resolved.ok ? resolved.absolutePath : undefined,
      fileState: !resolved.ok
        ? "unresolvable"
        : readResult?.fileState ?? "unreadable",
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

  // Reserializes from the parsed domain model rather than patching the
  // original document, so any comments or custom formatting in the file
  // are lost on save. Acceptable because board.yaml isn't meant to be
  // hand-maintained with comments - the app owns the file once it exists.
  save(
    path: string,
    board: Board,
    expectedRevision?: FileRevision,
  ): Promise<FileRevision> {
    return this.fileSystem.writeTextFile(
      path,
      stringify(this.toRaw(board)),
      expectedRevision,
    );
  }

  // Exclusive create: createTextFile's create-new semantics guarantee an
  // existing file is never overwritten, even when a concurrent existence
  // check has already passed. Already-exists classification is left to the
  // caller (usecase), so FileSystemError passes through untranslated.
  async create(path: string, board: Board): Promise<void> {
    await this.fileSystem.createTextFile(path, stringify(this.toRaw(board)));
  }

  private toRaw(board: Board): RawBoard {
    return {
      version: board.version,
      name: board.name,
      labels: board.labels.map((label) => ({
        name: label.name,
        color: label.color,
      })),
      // An empty board keeps an explicit `columns: []` key: load rejects
      // files whose columns is not an array, so omitting the key would
      // produce a board file this app cannot open again.
      columns: board.columns.map((column) => ({
        id: column.id,
        name: column.name,
        cards: column.cards.map((card) => ({
          path: card.path,
          ...(card.titleOverride ? { title: card.titleOverride } : {}),
          ...(card.priority ? { priority: card.priority } : {}),
          labels: card.labels,
        })),
      })),
    };
  }

  private async tryReadTextFile(path: string): Promise<{
    markdownText?: string;
    fileState: "available" | "missing" | "unreadable";
  }> {
    try {
      return {
        markdownText: await this.fileSystem.readTextFile(path),
        fileState: "available",
      };
    } catch (cause) {
      return {
        fileState: cause instanceof FileSystemError &&
            cause.kind === "not-found"
          ? "missing"
          : "unreadable",
      };
    }
  }
}
