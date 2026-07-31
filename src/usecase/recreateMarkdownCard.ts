import type { Card } from "../domain/card.ts";
import { relocateCardReference } from "../domain/card.ts";
import {
  CardFileValidationError,
  initialMarkdown,
  resolveNewMarkdownPathAt,
} from "../domain/cardFile.ts";
import type { FileSystemPort } from "../domain/fileSystemPort.ts";
import { createMarkdownFile } from "./createMarkdownFile.ts";
import { cardFileValidationToUseCaseError } from "./useCaseError.ts";

export interface RecreateMarkdownCardInput {
  boardPath: string;
  card: Card;
  absolutePath: string;
  title: string;
}

export interface RecreateMarkdownCardDeps {
  fileSystem: FileSystemPort;
}

// Repairs a card by writing the file it is missing, for the case the file was
// deleted or never written rather than moved. Creation is exclusive, so a file
// that exists but could not be read is reported as a collision instead of
// being overwritten.
export async function recreateMarkdownCard(
  { boardPath, card, absolutePath, title }: RecreateMarkdownCardInput,
  { fileSystem }: RecreateMarkdownCardDeps,
): Promise<Card> {
  let markdown: string;
  let target: ReturnType<typeof resolveNewMarkdownPathAt>;
  try {
    markdown = initialMarkdown(title);
    target = resolveNewMarkdownPathAt(boardPath, absolutePath);
  } catch (cause) {
    if (cause instanceof CardFileValidationError) {
      throw cardFileValidationToUseCaseError(cause);
    }
    throw cause;
  }

  await createMarkdownFile(target.absolutePath, markdown, { fileSystem });

  return relocateCardReference(
    card,
    target.relativePath,
    target.absolutePath,
    markdown,
  );
}
