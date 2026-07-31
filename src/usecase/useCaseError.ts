import type { BoardFileValidationError } from "../domain/boardFile.ts";
import type { CardFileValidationError } from "../domain/cardFile.ts";

export type UseCaseErrorCode =
  | "board.create-failed"
  | "board.file-already-exists"
  | "board.file-name-required"
  | "board.invalid-file-name"
  | "board.name-required"
  | "board.open-failed"
  | "board.save-failed"
  | "card.already-on-board"
  | "card.board-changed"
  | "card.create-failed"
  | "card.file-already-exists"
  | "card.file-name-required"
  | "card.file-not-found"
  | "card.invalid-file-name"
  | "card.load-failed"
  | "card.not-markdown-file"
  | "card.outside-board-directory"
  | "card.title-required"
  | "directory.already-exists"
  | "directory.browse-failed"
  | "directory.create-failed"
  | "directory.home-failed"
  | "directory.invalid-name"
  | "directory.name-required"
  | "label.already-exists"
  | "markdown.delete-failed"
  | "markdown.load-failed"
  | "markdown.save-failed"
  | "recent-boards.load-failed";

export class UseCaseError extends Error {
  readonly code: UseCaseErrorCode;
  readonly details: Readonly<Record<string, string>>;

  constructor(
    code: UseCaseErrorCode,
    details: Readonly<Record<string, string>> = {},
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = "UseCaseError";
    this.code = code;
    this.details = details;
  }
}

export function boardFileValidationToUseCaseError(
  error: BoardFileValidationError,
): UseCaseError {
  switch (error.kind) {
    case "name-required":
      return new UseCaseError("board.name-required", {}, { cause: error });
    case "file-name-required":
      return new UseCaseError("board.file-name-required", {}, { cause: error });
    case "invalid-file-name":
      return new UseCaseError("board.invalid-file-name", {}, { cause: error });
  }
}

export function cardFileValidationToUseCaseError(
  error: CardFileValidationError,
): UseCaseError {
  switch (error.kind) {
    case "title-required":
      return new UseCaseError("card.title-required", {}, { cause: error });
    case "file-name-required":
      return new UseCaseError("card.file-name-required", {}, { cause: error });
    case "invalid-file-name":
      return new UseCaseError("card.invalid-file-name", {}, { cause: error });
    case "not-markdown-file":
      return new UseCaseError("card.not-markdown-file", {}, { cause: error });
    case "outside-board-directory":
      return new UseCaseError(
        "card.outside-board-directory",
        {},
        { cause: error },
      );
  }
}
