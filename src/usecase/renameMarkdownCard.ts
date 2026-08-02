import type { Card } from "../domain/card.ts";
import { relocateCardReference } from "../domain/card.ts";
import {
  CardFileValidationError,
  resolveNewMarkdownPath,
} from "../domain/cardFile.ts";
import type { FileSystemPort } from "../domain/fileSystemPort.ts";
import { FileSystemError } from "../domain/fileSystemPort.ts";
import {
  cardFileValidationToUseCaseError,
  UseCaseError,
} from "./useCaseError.ts";

export interface RenameMarkdownCardInput {
  boardPath: string;
  card: Card;
  directory: string;
  fileName: string;
}

export interface RenameMarkdownCardDeps {
  fileSystem: FileSystemPort;
}

// Moves the file a card points at and hands back the card pointing at where it
// went. Renaming and moving are the same operation here, as they are for the
// file system underneath: both just name a new path inside the board
// directory.
// The file is read before it is moved, not after: the content is only needed
// to re-derive the title, and reading first keeps a failure from leaving the
// file somewhere the board does not know about.
// Shares its validate-then-act-then-relocate shape with relocateMarkdownCard
// and recreateMarkdownCard, but the act differs in all three - one reads, one
// creates, this one moves - so they stay apart.
export async function renameMarkdownCard(
  { boardPath, card, directory, fileName }: RenameMarkdownCardInput,
  { fileSystem }: RenameMarkdownCardDeps,
): Promise<Card> {
  if (!card.absolutePath) {
    // Invariant violation, not a recoverable user error: the rename UI only
    // exists on a card the viewer has open, and a card whose path never
    // resolved cannot be opened.
    throw new Error(`Card path is not resolvable: ${card.path}`);
  }

  let target: ReturnType<typeof resolveNewMarkdownPath>;
  try {
    target = resolveNewMarkdownPath(boardPath, directory, fileName);
  } catch (cause) {
    if (cause instanceof CardFileValidationError) {
      throw cardFileValidationToUseCaseError(cause);
    }
    throw cause;
  }

  const source = card.absolutePath;
  let markdown: string;
  try {
    markdown = await fileSystem.readTextFile(source);
  } catch (cause) {
    // Separated from a general read failure the same way repairing a card
    // separates them: "nothing is there" is the answer that explains why the
    // move did not happen.
    if (cause instanceof FileSystemError && cause.kind === "not-found") {
      throw new UseCaseError("card.file-not-found", { path: source }, {
        cause,
      });
    }
    throw new UseCaseError("card.load-failed", { path: source }, { cause });
  }

  try {
    await fileSystem.renameFile(source, target.absolutePath);
  } catch (cause) {
    if (cause instanceof FileSystemError) {
      // Anything in the way is about the destination the user just chose, so
      // it is reported the same way as creating a card there would be.
      if (cause.kind === "already-exists") {
        throw new UseCaseError(
          "card.file-already-exists",
          { path: target.absolutePath },
          { cause },
        );
      }
      // Kept apart from a plain collision: "a file is already there" sends the
      // user looking for a file that does not exist.
      if (cause.kind === "is-a-directory") {
        throw new UseCaseError(
          "card.file-is-a-directory",
          { path: target.absolutePath },
          { cause },
        );
      }
      if (cause.kind === "not-found") {
        throw new UseCaseError(
          "card.file-not-found",
          { path: source },
          { cause },
        );
      }
    }
    throw new UseCaseError(
      "card.move-failed",
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
