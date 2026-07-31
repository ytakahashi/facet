import type { Card } from "../domain/card.ts";
import { createCardReference } from "../domain/card.ts";
import {
  CardFileValidationError,
  initialMarkdown,
  resolveNewMarkdownPath,
} from "../domain/cardFile.ts";
import type { FileSystemPort } from "../domain/fileSystemPort.ts";
import { createMarkdownFile } from "./createMarkdownFile.ts";
import { cardFileValidationToUseCaseError } from "./useCaseError.ts";

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

  await createMarkdownFile(path.absolutePath, markdown, { fileSystem });

  return createCardReference(path.relativePath, path.absolutePath, markdown);
}
