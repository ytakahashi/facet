import { describe, expect, it, vi } from "vite-plus/test";
import { UseCaseError } from "../../usecase/useCaseError.ts";
import { toUiError } from "../errors/toUiError.ts";
import { createMenuActions } from "./menuActions.ts";

describe("createMenuActions", () => {
  it("reports a clipboard failure through the app alert", async () => {
    const showAlert = vi.fn();
    const error = new UseCaseError("clipboard.write-failed");
    const copyText = vi.fn(() => Promise.reject(error));
    const { copyText: copy } = createMenuActions({
      clipboard: { copyText },
      finder: { reveal: vi.fn() },
      showAlert,
    });

    copy("notes/card.md");
    await Promise.resolve();

    expect(copyText).toHaveBeenCalledWith("notes/card.md");
    expect(showAlert).toHaveBeenCalledWith(toUiError(error).message);
  });

  it("reports a Finder failure through the app alert", async () => {
    const showAlert = vi.fn();
    const error = new UseCaseError("finder.not-found", {
      path: "/board/card.md",
    });
    const reveal = vi.fn(() => Promise.reject(error));
    const { reveal: revealCard } = createMenuActions({
      clipboard: { copyText: vi.fn() },
      finder: { reveal },
      showAlert,
    });

    revealCard("/board/card.md");
    await Promise.resolve();

    expect(reveal).toHaveBeenCalledWith("/board/card.md");
    expect(showAlert).toHaveBeenCalledWith(toUiError(error).message);
  });
});
