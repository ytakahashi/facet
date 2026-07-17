import type { Card } from "../domain/card.ts";
import { createCardReference } from "../domain/card.ts";
import {
  CardFileValidationError,
  initialMarkdown,
  resolveNewMarkdownPath,
} from "../domain/cardFile.ts";
import {
  FileSystemError,
  type FileSystemPort,
} from "../domain/fileSystemPort.ts";
import {
  cardFileValidationToUseCaseError,
  UseCaseError,
} from "./useCaseError.ts";

export interface CreateMarkdownCardInput {
  boardPath: string;
  directory: string;
  fileName: string;
  title: string;
}

export interface CreateMarkdownCardDeps {
  fileSystem: FileSystemPort;
}

export async function createMarkdownCard(
  input: CreateMarkdownCardInput,
  { fileSystem }: CreateMarkdownCardDeps,
): Promise<Card> {
  let markdown: string;
  let path: ReturnType<typeof resolveNewMarkdownPath>;
  try {
    markdown = initialMarkdown(input.title);
    path = resolveNewMarkdownPath(
      input.boardPath,
      input.directory,
      input.fileName,
    );
  } catch (cause) {
    if (cause instanceof CardFileValidationError) {
      throw cardFileValidationToUseCaseError(cause);
    }
    throw cause;
  }

  let exists: boolean;
  try {
    exists = await fileSystem.exists(path.absolutePath);
  } catch (cause) {
    throw new UseCaseError(
      "card.create-failed",
      { path: path.absolutePath },
      { cause },
    );
  }
  if (exists) {
    throw new UseCaseError("card.file-already-exists", {
      path: path.absolutePath,
    });
  }

  try {
    await fileSystem.createTextFile(path.absolutePath, markdown);
  } catch (cause) {
    if (cause instanceof FileSystemError && cause.kind === "already-exists") {
      throw new UseCaseError(
        "card.file-already-exists",
        { path: path.absolutePath },
        { cause },
      );
    }
    throw new UseCaseError(
      "card.create-failed",
      { path: path.absolutePath },
      { cause },
    );
  }
  return createCardReference(path.relativePath, path.absolutePath, markdown);
}
