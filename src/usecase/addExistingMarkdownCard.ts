import type { Card } from "../domain/card.ts";
import { createCardReference } from "../domain/card.ts";
import {
  CardFileValidationError,
  resolveExistingMarkdownPath,
} from "../domain/cardFile.ts";
import type { FileSystemPort } from "../domain/fileSystemPort.ts";
import {
  cardFileValidationToUseCaseError,
  UseCaseError,
} from "./useCaseError.ts";

export interface AddExistingMarkdownCardInput {
  boardPath: string;
  absolutePath: string;
}

export interface AddExistingMarkdownCardDeps {
  fileSystem: FileSystemPort;
}

export async function addExistingMarkdownCard(
  input: AddExistingMarkdownCardInput,
  { fileSystem }: AddExistingMarkdownCardDeps,
): Promise<Card> {
  let path: ReturnType<typeof resolveExistingMarkdownPath>;
  try {
    path = resolveExistingMarkdownPath(input.boardPath, input.absolutePath);
  } catch (cause) {
    if (cause instanceof CardFileValidationError) {
      throw cardFileValidationToUseCaseError(cause);
    }
    throw cause;
  }

  let markdown: string;
  try {
    markdown = await fileSystem.readTextFile(path.absolutePath);
  } catch (cause) {
    throw new UseCaseError(
      "card.load-failed",
      { path: path.absolutePath },
      { cause },
    );
  }

  return createCardReference(path.relativePath, path.absolutePath, markdown);
}
