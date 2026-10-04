import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { UseCaseError } from "../../usecase/useCaseError.ts";
import { AppProvider } from "../context/appContext.ts";
import type { AppDependencies } from "../context/appContext.ts";
import { toUiError } from "../errors/toUiError.ts";
import { useMenuActions } from "./useMenuActions.ts";

function getActions(dependencies: Partial<AppDependencies>) {
  let actions: ReturnType<typeof useMenuActions> | undefined;

  function Probe() {
    actions = useMenuActions();
    return null;
  }

  renderToStaticMarkup(
    <AppProvider value={dependencies as AppDependencies}>
      <Probe />
    </AppProvider>,
  );
  if (!actions) throw new Error("The menu actions were not rendered");
  return actions;
}

describe("useMenuActions", () => {
  it("reports a clipboard failure through the app alert", async () => {
    const showAlert = vi.fn();
    const error = new UseCaseError("clipboard.write-failed");
    const copyText = vi.fn(() => Promise.reject(error));
    const { copyText: copy } = getActions({
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
    const { reveal: revealCard } = getActions({
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
