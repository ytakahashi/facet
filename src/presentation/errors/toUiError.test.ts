import { describe, expect, it, vi } from "vitest";
import { UseCaseError } from "../../usecase/useCaseError.ts";
import { toUiError } from "./toUiError.ts";

describe("toUiError", () => {
  it("maps a usecase code and details to a field error", () => {
    const error = new UseCaseError("card.file-already-exists", {
      path: "/board/card.md",
    });

    const result = toUiError(error);

    expect(result).toEqual({
      message: "A file already exists at /board/card.md.",
      field: "fileName",
    });
  });

  it("maps validation errors without relying on an Error message", () => {
    const error = new UseCaseError("card.title-required");

    const result = toUiError(error);

    expect(result).toEqual({
      message: "Title is required.",
      field: "title",
    });
  });

  it("maps a blank board name to the board name field", () => {
    const error = new UseCaseError("board.name-required");

    const result = toUiError(error);

    expect(result).toEqual({
      message: "Board name is required.",
      field: "boardName",
    });
  });

  it("maps an existing board file path to the file name field", () => {
    const error = new UseCaseError("board.file-already-exists", {
      path: "/boards/facet.board.yaml",
    });

    const result = toUiError(error);

    expect(result).toEqual({
      message: "A file already exists at /boards/facet.board.yaml.",
      field: "fileName",
    });
  });

  it("maps a board creation failure without exposing its cause", () => {
    const error = new UseCaseError(
      "board.create-failed",
      { path: "/boards/facet.board.yaml" },
      { cause: new Error("Permission denied") },
    );

    const result = toUiError(error);

    expect(result).toEqual({
      message: "Failed to create the board at /boards/facet.board.yaml.",
    });
  });

  it("maps an existing Markdown read failure without exposing its cause", () => {
    const error = new UseCaseError(
      "card.load-failed",
      { path: "/board/existing.md" },
      { cause: new Error("Permission denied") },
    );

    const result = toUiError(error);

    expect(result).toEqual({
      message: "Failed to load the Markdown file at /board/existing.md.",
    });
  });

  it("maps a missing Markdown file to a message naming the path", () => {
    const error = new UseCaseError(
      "card.file-not-found",
      { path: "/board/moved.md" },
      { cause: new Error("not-found") },
    );

    const result = toUiError(error);

    expect(result).toEqual({
      message: "No Markdown file at this path at /board/moved.md.",
    });
  });

  it("maps a location outside the board directory without naming an operation", () => {
    const result = toUiError(new UseCaseError("card.outside-board-directory"));

    expect(result).toEqual({
      message: "Choose a location inside the board directory.",
      field: "directory",
    });
  });

  it("maps a Markdown delete failure to a message naming the file", () => {
    const error = new UseCaseError(
      "markdown.delete-failed",
      { path: "/board/improve-search.md" },
      { cause: new Error("Permission denied") },
    );

    const result = toUiError(error);

    expect(result).toEqual({
      message:
        "Failed to delete the Markdown file at /board/improve-search.md.",
    });
  });

  it("maps a mid-operation board change to an operation-independent message", () => {
    const error = new UseCaseError("card.board-changed");

    const result = toUiError(error);

    expect(result).toEqual({
      message: "The board changed. Reopen the board and try again.",
    });
  });

  it("maps a duplicate label name to the label name field", () => {
    const error = new UseCaseError("label.already-exists", { name: "ui" });

    const result = toUiError(error);

    expect(result).toEqual({
      message: "A label with this name already exists.",
      field: "labelName",
    });
  });

  it("hides unexpected error details and logs the original error", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(
      () => {},
    );
    const error = new Error("sensitive internal detail");

    const result = toUiError(error);

    expect(result).toEqual({ message: "An unexpected error occurred." });
    expect(consoleError).toHaveBeenCalledWith(
      "Unexpected application error:",
      error,
    );
    consoleError.mockRestore();
  });
});
