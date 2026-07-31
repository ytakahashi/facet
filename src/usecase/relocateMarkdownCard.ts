import type { Card } from "../domain/card.ts";
import { relocateCardReference } from "../domain/card.ts";
import {
  CardFileValidationError,
  resolveExistingMarkdownPath,
} from "../domain/cardFile.ts";
import type { FileSystemPort } from "../domain/fileSystemPort.ts";
import { FileSystemError } from "../domain/fileSystemPort.ts";
import {
  cardFileValidationToUseCaseError,
  UseCaseError,
} from "./useCaseError.ts";

export interface RelocateMarkdownCardInput {
  boardPath: string;
  card: Card;
  absolutePath: string;
}

export interface RelocateMarkdownCardDeps {
  fileSystem: FileSystemPort;
}

// Repairs a card whose file could not be read by pointing it at a file that
// can be. The same path the card already has is a valid input: re-reading it is
// how a file restored outside the app gets picked up.
// Shares its validate-then-read shape with addExistingMarkdownCard, but not its
// result: that one starts a new reference, this one carries an existing card's
// board metadata across. Folding them together would leave a helper that only
// reads a file.
export async function relocateMarkdownCard(
  { boardPath, card, absolutePath }: RelocateMarkdownCardInput,
  { fileSystem }: RelocateMarkdownCardDeps,
): Promise<Card> {
  let target: ReturnType<typeof resolveExistingMarkdownPath>;
  try {
    target = resolveExistingMarkdownPath(boardPath, absolutePath);
  } catch (cause) {
    if (cause instanceof CardFileValidationError) {
      throw cardFileValidationToUseCaseError(cause);
    }
    throw cause;
  }

  let markdown: string;
  try {
    markdown = await fileSystem.readTextFile(target.absolutePath);
  } catch (cause) {
    // Separated from a general read failure: "nothing is there" is the answer
    // that tells the user to pick a different file, and it is the expected
    // outcome of a typed path.
    if (cause instanceof FileSystemError && cause.kind === "not-found") {
      throw new UseCaseError(
        "card.file-not-found",
        { path: target.absolutePath },
        { cause },
      );
    }
    throw new UseCaseError(
      "card.load-failed",
      { path: target.absolutePath },
      { cause },
    );
  }

  return relocateCardReference(
    card,
    target.relativePath,
    target.absolutePath,
    markdown,
  );
}
