import { afterEach, describe, expect, it, vi } from "vitest";
import { DenoFinder } from "./denoFinder.ts";

describe("DenoFinder", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("passes the path through the binding", async () => {
    const revealInFinder = vi.fn().mockResolvedValue({ revealed: true });
    vi.stubGlobal("bindings", { revealInFinder });

    await new DenoFinder().reveal("/board/card.md");

    expect(revealInFinder).toHaveBeenCalledWith("/board/card.md");
  });

  it("maps a not-found result to a typed error", async () => {
    vi.stubGlobal("bindings", {
      revealInFinder: vi.fn().mockResolvedValue({
        revealed: false,
        reason: "not-found",
      }),
    });

    await expect(new DenoFinder().reveal("/board/card.md")).rejects
      .toMatchObject({ kind: "not-found", operation: "reveal" });
  });

  it("maps a rejected binding to a failed reveal", async () => {
    const cause = new Error("binding unavailable");
    vi.stubGlobal("bindings", {
      revealInFinder: vi.fn().mockRejectedValue(cause),
    });

    await expect(new DenoFinder().reveal("/board/card.md")).rejects
      .toMatchObject({ kind: "failed", cause });
  });
});
