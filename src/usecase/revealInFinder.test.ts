import { describe, expect, it, vi } from "vitest";
import { FinderError, type FinderPort } from "../domain/finderPort.ts";
import { revealInFinder } from "./revealInFinder.ts";

describe("revealInFinder", () => {
  it.each(
    [
      ["not-found", "finder.not-found"],
      ["failed", "finder.reveal-failed"],
    ] as const,
  )("maps %s to %s with the path", async (kind, code) => {
    const cause = new FinderError(kind);
    const finder: FinderPort = { reveal: vi.fn().mockRejectedValue(cause) };

    await expect(revealInFinder("/board/card.md", { finder })).rejects
      .toMatchObject({ code, details: { path: "/board/card.md" }, cause });
  });
});
