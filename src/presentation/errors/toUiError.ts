import { UseCaseError } from "../../usecase/useCaseError.ts";

export type UiErrorField = "title" | "fileName" | "directory";

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
    case "board.open-failed":
      return { message: `Failed to open the board${atPath(path)}.` };
    case "board.save-failed":
      return { message: `Failed to save the board${atPath(path)}.` };
    case "card.already-on-board":
      return { message: "This Markdown is already on this board." };
    case "card.board-changed":
      return { message: "The board changed while the Markdown was created." };
    case "card.create-failed":
      return { message: `Failed to create the Markdown file${atPath(path)}.` };
    case "card.file-already-exists":
      return {
        message: `A file already exists${atPath(path)}.`,
        field: "fileName",
      };
    case "card.file-name-required":
      return { message: "File name is required.", field: "fileName" };
    case "card.invalid-file-name":
      return { message: "Enter a single valid file name.", field: "fileName" };
    case "card.outside-board-directory":
      return {
        message: "Choose a directory inside the board directory.",
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
