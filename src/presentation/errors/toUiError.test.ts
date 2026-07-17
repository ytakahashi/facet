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
