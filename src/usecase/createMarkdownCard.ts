import type { Card } from "../domain/card.ts";
import { createCardReference } from "../domain/card.ts";
import { initialMarkdown, resolveNewMarkdownPath } from "../domain/cardFile.ts";
import type { FileSystemPort } from "../domain/fileSystemPort.ts";

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
  const markdown = initialMarkdown(input.title);
  const path = resolveNewMarkdownPath(
    input.boardPath,
    input.directory,
    input.fileName,
  );

  if (await fileSystem.exists(path.absolutePath)) {
    throw new Error(`A file already exists at ${path.absolutePath}`);
  }

  try {
    await fileSystem.createTextFile(path.absolutePath, markdown);
  } catch (cause) {
    // The exists() check above is only for a friendly error message; a
    // concurrent writer can still win the race against createNew: true.
    // Deno's raw error for that case isn't user-facing, so normalize it to
    // the same message as the upfront check.
    throw new Error(`A file already exists at ${path.absolutePath}`, {
      cause,
    });
  }
  return createCardReference(path.relativePath, path.absolutePath, markdown);
}
