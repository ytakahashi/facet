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
