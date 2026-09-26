import { describe, expect, it, vi } from "vitest";
import type { ClipboardPort } from "../domain/clipboardPort.ts";
import { copyToClipboard } from "./copyToClipboard.ts";
import { UseCaseError } from "./useCaseError.ts";

describe("copyToClipboard", () => {
  it("maps a clipboard failure to a use case error with its cause", async () => {
    const cause = new Error("denied");
    const clipboard: ClipboardPort = {
      writeText: vi.fn().mockRejectedValue(cause),
    };

    await expect(copyToClipboard("notes/card.md", { clipboard })).rejects
      .toMatchObject(
        {
          code: "clipboard.write-failed",
          details: {},
          cause,
        } satisfies Partial<UseCaseError>,
      );
  });
});
