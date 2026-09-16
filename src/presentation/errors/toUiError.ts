import { UseCaseError } from "../../usecase/useCaseError.ts";

export type UiErrorField =
  | "title"
  | "fileName"
  | "directory"
  | "boardName"
  | "labelName";

export interface UiError {
  message: string;
  field?: UiErrorField;
}

export function toUiError(error: unknown): UiError {
  if (!(error instanceof UseCaseError)) {
    console.error("Unexpected application error:", error);
    return { message: "An unexpected error occurred." };
  }

  const path = error.details.path;
  switch (error.code) {
    case "board.create-failed":
      return { message: `Failed to create the board${atPath(path)}.` };
    case "board.conflict":
      return { message: "The board file changed outside Facet." };
    case "board.file-already-exists":
      return {
        message: `A file already exists${atPath(path)}.`,
        field: "fileName",
      };
    case "board.file-name-required":
      return { message: "File name is required.", field: "fileName" };
    case "board.invalid-file-name":
      return { message: "Enter a single valid file name.", field: "fileName" };
    case "board.name-required":
      return { message: "Board name is required.", field: "boardName" };
    case "board.open-failed":
      return { message: `Failed to open the board${atPath(path)}.` };
    case "board.save-failed":
      return { message: `Failed to save the board${atPath(path)}.` };
    case "card.already-on-board":
      return { message: "This Markdown is already on this board." };
    // Raised by every board-mutating flow that awaits file I/O first, so the
    // wording stays independent of which operation was interrupted.
    case "card.board-changed":
      return { message: "The board changed. Reopen the board and try again." };
    case "card.create-failed":
      return { message: `Failed to create the Markdown file${atPath(path)}.` };
    case "card.file-already-exists":
      return {
        message: `A file already exists${atPath(path)}.`,
        field: "fileName",
      };
    // Told apart from a plain collision: naming a file that is not there is
    // worse than saying nothing, and either the file name or the directory can
    // be changed to get out of the way - the same two fields a collision is
    // fixed from.
    case "card.file-is-a-directory":
      return {
        message: `A directory already exists${atPath(path)}.`,
        field: "fileName",
      };
    case "card.file-name-required":
      return { message: "File name is required.", field: "fileName" };
    // Told apart from card.load-failed: after choosing or typing a path, what
    // the user needs to know first is whether anything is there at all.
    case "card.file-not-found":
      return { message: `No Markdown file at this path${atPath(path)}.` };
    case "card.invalid-file-name":
      return { message: "Enter a single valid file name.", field: "fileName" };
    case "card.load-failed":
      return { message: `Failed to load the Markdown file${atPath(path)}.` };
    case "card.move-failed":
      return { message: `Failed to move the Markdown file${atPath(path)}.` };
    case "card.not-markdown-file":
      return { message: "Select a Markdown (.md) file." };
    // Reached both by picking a directory and by typing a path, so the wording
    // names neither operation.
    case "card.outside-board-directory":
      return {
        message: "Choose a location inside the board directory.",
        field: "directory",
      };
    case "card.title-required":
      return { message: "Title is required.", field: "title" };
    case "directory.already-exists":
      return { message: `A file or directory already exists${atPath(path)}.` };
    case "directory.browse-failed":
      return { message: `Failed to read the directory${atPath(path)}.` };
    case "directory.create-failed":
      return { message: `Failed to create the directory${atPath(path)}.` };
    case "directory.home-failed":
      return { message: "Failed to find the home directory." };
    case "directory.invalid-name":
      return { message: "Enter a single valid directory name." };
    case "directory.name-required":
      return { message: "Directory name is required." };
    case "label.already-exists":
      return {
        message: "A label with this name already exists.",
        field: "labelName",
      };
    case "markdown.delete-failed":
      return { message: `Failed to delete the Markdown file${atPath(path)}.` };
    case "markdown.conflict":
      return {
        message: "This file changed outside Facet.",
      };
    case "markdown.file-gone":
      return { message: `This file no longer exists${atPath(path)}.` };
    case "markdown.load-failed":
      return { message: `Failed to load the Markdown file${atPath(path)}.` };
    case "markdown.save-failed":
      return { message: `Failed to save the Markdown file${atPath(path)}.` };
    case "recent-boards.load-failed":
      return { message: "Failed to load recent boards." };
  }
}

function atPath(path: string | undefined): string {
  return path ? ` at ${path}` : "";
}
