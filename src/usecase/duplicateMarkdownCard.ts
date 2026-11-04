import type { Card } from "../domain/card.ts";
import { relocateCardReference } from "../domain/card.ts";
import { isSameCardPath, directoryOf } from "../domain/boardPath.ts";
import {
  duplicateMarkdownFileName,
  resolveNewMarkdownPath,
  CardFileValidationError,
} from "../domain/cardFile.ts";
import {
  FileSystemError,
  type FileSystemPort,
} from "../domain/fileSystemPort.ts";
import { createMarkdownFile } from "./createMarkdownFile.ts";
import {
  UseCaseError,
  cardFileValidationToUseCaseError,
} from "./useCaseError.ts";

export interface DuplicateMarkdownCardInput {
  boardPath: string;
  card: Card;
  reservedPaths: readonly string[];
}

export async function duplicateMarkdownCard(
  { boardPath, card, reservedPaths }: DuplicateMarkdownCardInput,
  { fileSystem }: { fileSystem: FileSystemPort },
): Promise<Card> {
  if (!card.absolutePath)
    throw new Error(`Card path is not resolvable: ${card.path}`);
  let markdown: string;
  try {
    // Read saved content, never the viewer's possibly unsaved draft.
    markdown = await fileSystem.readTextFile(card.absolutePath);
  } catch (cause) {
    throw new UseCaseError(
      cause instanceof FileSystemError && cause.kind === "not-found"
        ? "card.file-not-found"
        : "card.load-failed",
      { path: card.absolutePath },
      { cause },
    );
  }
  for (let number = 1; ; number++) {
    let target: ReturnType<typeof resolveNewMarkdownPath>;
    try {
      target = resolveNewMarkdownPath(
        boardPath,
        directoryOf(card.absolutePath),
        duplicateMarkdownFileName(card.path, number),
      );
    } catch (cause) {
      if (cause instanceof CardFileValidationError)
        throw cardFileValidationToUseCaseError(cause);
      throw cause;
    }
    // Missing files still reserve their card identities on the board.
    if (reservedPaths.some((path) => isSameCardPath(path, target.relativePath)))
      continue;
    try {
      await createMarkdownFile(target.absolutePath, markdown, { fileSystem });
    } catch (cause) {
      // Exclusive creation also catches files appearing after the existence check.
      if (
        cause instanceof UseCaseError &&
        cause.code === "card.file-already-exists"
      )
        continue;
      throw cause;
    }
    return {
      ...relocateCardReference(
        card,
        target.relativePath,
        target.absolutePath,
        markdown,
      ),
      labels: [...card.labels],
    };
  }
}
