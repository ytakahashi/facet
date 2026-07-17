import type { CardFileValidationError } from "../domain/cardFile.ts";

export type UseCaseErrorCode =
  | "board.open-failed"
  | "board.save-failed"
  | "card.already-on-board"
  | "card.board-changed"
  | "card.create-failed"
  | "card.file-already-exists"
  | "card.file-name-required"
  | "card.invalid-file-name"
  | "card.outside-board-directory"
  | "card.title-required"
  | "directory.already-exists"
  | "directory.browse-failed"
  | "directory.create-failed"
  | "directory.home-failed"
  | "directory.invalid-name"
  | "directory.name-required"
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
    case "outside-board-directory":
      return new UseCaseError(
        "card.outside-board-directory",
        {},
        { cause: error },
      );
  }
}
