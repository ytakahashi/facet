import { describe, expect, it, vi } from "vitest";
import type { Card } from "../../domain/card.ts";
import { UseCaseError } from "../../usecase/useCaseError.ts";
import { toUiError } from "../errors/toUiError.ts";
import {
  createMarkdownViewerStore,
  isCardSaving,
} from "./markdownViewerStore.ts";

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    path: "improve-search.md",
    absolutePath: "/board/improve-search.md",
    fileState: "available",
    labels: [],
    displayTitle: "Improve search",
    ...overrides,
  };
}

function alwaysDiscard() {
  return true;
}

function neverDiscard() {
  return false;
}

describe("createMarkdownViewerStore", () => {
  it("moves to loaded with the file's content once viewMarkdown resolves", async () => {
    const card = makeCard();
    const useMarkdownViewer = createMarkdownViewerStore(
      () => Promise.resolve("# Improve search"),
      vi.fn(),
      alwaysDiscard,
    );

    await useMarkdownViewer.getState().selectCard(card);

    expect(useMarkdownViewer.getState().status).toBe("loaded");
    expect(useMarkdownViewer.getState().selectedPath).toBe(card.path);
    expect(useMarkdownViewer.getState().content).toBe("# Improve search");
    expect(useMarkdownViewer.getState().draft).toBe("# Improve search");
  });

  it("moves to error with the toUiError message when viewMarkdown rejects", async () => {
    const card = makeCard();
    const loadFailedError = new UseCaseError("markdown.load-failed", {
      path: "/board/improve-search.md",
    });
    const useMarkdownViewer = createMarkdownViewerStore(
      () => Promise.reject(loadFailedError),
      vi.fn(),
      alwaysDiscard,
    );

    await useMarkdownViewer.getState().selectCard(card);

    expect(useMarkdownViewer.getState().status).toBe("error");
    expect(useMarkdownViewer.getState().error).toBe(
      toUiError(loadFailedError).message,
    );
  });

  it("moves to error without calling viewMarkdown when the card has no absolute path", async () => {
    const card = makeCard({ absolutePath: undefined });
    const viewMarkdown = vi.fn();
    const useMarkdownViewer = createMarkdownViewerStore(
      viewMarkdown,
      vi.fn(),
      alwaysDiscard,
    );

    await useMarkdownViewer.getState().selectCard(card);

    expect(useMarkdownViewer.getState().status).toBe("error");
    expect(viewMarkdown).not.toHaveBeenCalled();
  });

  it("resets to idle with no selection or content when closed", async () => {
    const card = makeCard();
    const useMarkdownViewer = createMarkdownViewerStore(
      () => Promise.resolve("# Improve search"),
      vi.fn(),
      alwaysDiscard,
    );
    await useMarkdownViewer.getState().selectCard(card);

    const result = useMarkdownViewer.getState().close();

    expect(result).toBe(true);
    expect(useMarkdownViewer.getState().status).toBe("idle");
    expect(useMarkdownViewer.getState().selectedPath).toBeUndefined();
    expect(useMarkdownViewer.getState().content).toBeUndefined();
  });

  it("updates the draft without touching the saved content", async () => {
    const card = makeCard();
    const useMarkdownViewer = createMarkdownViewerStore(
      () => Promise.resolve("# Improve search"),
      vi.fn(),
      alwaysDiscard,
    );
    await useMarkdownViewer.getState().selectCard(card);

    useMarkdownViewer.getState().updateDraft("# Improve search (edited)");

    expect(useMarkdownViewer.getState().draft).toBe(
      "# Improve search (edited)",
    );
    expect(useMarkdownViewer.getState().content).toBe("# Improve search");
  });

  it("saves the draft and moves it into the saved content on success", async () => {
    const card = makeCard();
    const saveMarkdown = vi.fn().mockResolvedValue(undefined);
    const useMarkdownViewer = createMarkdownViewerStore(
      () => Promise.resolve("# Improve search"),
      saveMarkdown,
      alwaysDiscard,
    );
    await useMarkdownViewer.getState().selectCard(card);
    useMarkdownViewer.getState().updateDraft("# Improve search (edited)");

    await useMarkdownViewer.getState().save();

    expect(saveMarkdown).toHaveBeenCalledWith(
      "/board/improve-search.md",
      "# Improve search (edited)",
    );
    expect(useMarkdownViewer.getState().content).toBe(
      "# Improve search (edited)",
    );
    expect(isCardSaving(useMarkdownViewer.getState(), card.path)).toBe(false);
  });

  it("keeps the draft and reports an error when saving fails", async () => {
    const card = makeCard();
    const saveFailedError = new UseCaseError("markdown.save-failed", {
      path: "/board/improve-search.md",
    });
    const saveMarkdown = vi.fn().mockRejectedValue(saveFailedError);
    const useMarkdownViewer = createMarkdownViewerStore(
      () => Promise.resolve("# Improve search"),
      saveMarkdown,
      alwaysDiscard,
    );
    await useMarkdownViewer.getState().selectCard(card);
    useMarkdownViewer.getState().updateDraft("# Improve search (edited)");

    await useMarkdownViewer.getState().save();

    expect(useMarkdownViewer.getState().saveError).toBe(
      toUiError(saveFailedError).message,
    );
    expect(useMarkdownViewer.getState().content).toBe("# Improve search");
    expect(useMarkdownViewer.getState().draft).toBe(
      "# Improve search (edited)",
    );
  });

  it("asks for confirmation before discarding an unsaved edit on selectCard, and keeps the edit when declined", async () => {
    const card = makeCard();
    const otherCard = makeCard({
      path: "redesign-sidebar.md",
      absolutePath: "/board/redesign-sidebar.md",
    });
    const viewMarkdown = vi.fn().mockResolvedValue("# Improve search");
    const useMarkdownViewer = createMarkdownViewerStore(
      viewMarkdown,
      vi.fn(),
      neverDiscard,
    );
    await useMarkdownViewer.getState().selectCard(card);
    useMarkdownViewer.getState().updateDraft("# Improve search (edited)");

    await useMarkdownViewer.getState().selectCard(otherCard);

    expect(useMarkdownViewer.getState().selectedPath).toBe(card.path);
    expect(useMarkdownViewer.getState().draft).toBe(
      "# Improve search (edited)",
    );
    expect(viewMarkdown).toHaveBeenCalledTimes(1);
  });

  it("loads the new card once discarding an unsaved edit is confirmed", async () => {
    const card = makeCard();
    const otherCard = makeCard({
      path: "redesign-sidebar.md",
      absolutePath: "/board/redesign-sidebar.md",
    });
    const viewMarkdown = vi.fn()
      .mockResolvedValueOnce("# Improve search")
      .mockResolvedValueOnce("# Redesign sidebar");
    const useMarkdownViewer = createMarkdownViewerStore(
      viewMarkdown,
      vi.fn(),
      alwaysDiscard,
    );
    await useMarkdownViewer.getState().selectCard(card);
    useMarkdownViewer.getState().updateDraft("# Improve search (edited)");

    await useMarkdownViewer.getState().selectCard(otherCard);

    expect(useMarkdownViewer.getState().selectedPath).toBe(otherCard.path);
    expect(useMarkdownViewer.getState().content).toBe("# Redesign sidebar");
  });

  it("does not reload or ask for confirmation when re-selecting the already selected card", async () => {
    const card = makeCard();
    const viewMarkdown = vi.fn().mockResolvedValue("# Improve search");
    const confirmDiscard = vi.fn(neverDiscard);
    const useMarkdownViewer = createMarkdownViewerStore(
      viewMarkdown,
      vi.fn(),
      confirmDiscard,
    );
    await useMarkdownViewer.getState().selectCard(card);
    useMarkdownViewer.getState().updateDraft("# Improve search (edited)");

    await useMarkdownViewer.getState().selectCard(card);

    expect(confirmDiscard).not.toHaveBeenCalled();
    expect(viewMarkdown).toHaveBeenCalledTimes(1);
    expect(useMarkdownViewer.getState().draft).toBe(
      "# Improve search (edited)",
    );
  });

  it("asks for confirmation before discarding an unsaved edit on close, and keeps the edit when declined", async () => {
    const card = makeCard();
    const useMarkdownViewer = createMarkdownViewerStore(
      () => Promise.resolve("# Improve search"),
      vi.fn(),
      neverDiscard,
    );
    await useMarkdownViewer.getState().selectCard(card);
    useMarkdownViewer.getState().updateDraft("# Improve search (edited)");

    const result = useMarkdownViewer.getState().close();

    expect(result).toBe(false);
    expect(useMarkdownViewer.getState().status).toBe("loaded");
    expect(useMarkdownViewer.getState().draft).toBe(
      "# Improve search (edited)",
    );
  });

  it("resets the viewer for a discarded card without asking to confirm, even with unsaved changes", async () => {
    const card = makeCard();
    const confirmDiscard = vi.fn(neverDiscard);
    const useMarkdownViewer = createMarkdownViewerStore(
      () => Promise.resolve("# Improve search"),
      vi.fn(),
      confirmDiscard,
    );
    await useMarkdownViewer.getState().selectCard(card);
    useMarkdownViewer.getState().updateDraft("# Improve search (edited)");

    useMarkdownViewer.getState().discardCard(card.path);

    expect(confirmDiscard).not.toHaveBeenCalled();
    expect(useMarkdownViewer.getState().status).toBe("idle");
    expect(useMarkdownViewer.getState().selectedPath).toBeUndefined();
    expect(useMarkdownViewer.getState().draft).toBeUndefined();
  });

  it("stays closed when a load that was already in flight resolves after the card is discarded", async () => {
    const card = makeCard();
    let finishLoad!: (content: string) => void;
    const loading = new Promise<string>((resolve) => {
      finishLoad = resolve;
    });
    const useMarkdownViewer = createMarkdownViewerStore(
      () => loading,
      vi.fn(),
      alwaysDiscard,
    );

    const selecting = useMarkdownViewer.getState().selectCard(card);
    useMarkdownViewer.getState().discardCard(card.path);
    finishLoad("# Improve search");
    await selecting;

    expect(useMarkdownViewer.getState().status).toBe("idle");
    expect(useMarkdownViewer.getState().selectedPath).toBeUndefined();
    expect(useMarkdownViewer.getState().draft).toBeUndefined();
  });

  it("stays closed when a load that was already in flight fails after the card is discarded", async () => {
    const card = makeCard();
    let failLoad!: (error: Error) => void;
    const loading = new Promise<string>((_resolve, reject) => {
      failLoad = reject;
    });
    const useMarkdownViewer = createMarkdownViewerStore(
      () => loading,
      vi.fn(),
      alwaysDiscard,
    );

    const selecting = useMarkdownViewer.getState().selectCard(card);
    useMarkdownViewer.getState().discardCard(card.path);
    failLoad(new UseCaseError("markdown.load-failed", { path: "/board/a.md" }));
    await selecting;

    expect(useMarkdownViewer.getState().status).toBe("idle");
    expect(useMarkdownViewer.getState().error).toBeUndefined();
  });

  it("stays closed when a save that was already in flight resolves after the card is discarded", async () => {
    const card = makeCard();
    let finishSave!: () => void;
    const saving = new Promise<void>((resolve) => {
      finishSave = resolve;
    });
    const useMarkdownViewer = createMarkdownViewerStore(
      () => Promise.resolve("# Improve search"),
      vi.fn().mockReturnValue(saving),
      alwaysDiscard,
    );
    await useMarkdownViewer.getState().selectCard(card);
    useMarkdownViewer.getState().updateDraft("# Improve search (edited)");

    const savingCall = useMarkdownViewer.getState().save();
    useMarkdownViewer.getState().discardCard(card.path);
    finishSave();
    await savingCall;

    expect(useMarkdownViewer.getState().status).toBe("idle");
    expect(useMarkdownViewer.getState().selectedPath).toBeUndefined();
    expect(useMarkdownViewer.getState().content).toBeUndefined();
  });

  it("reports the card as saving only while its own write is in flight", async () => {
    const card = makeCard();
    let finishSave!: () => void;
    const saving = new Promise<void>((resolve) => {
      finishSave = resolve;
    });
    const useMarkdownViewer = createMarkdownViewerStore(
      () => Promise.resolve("# Improve search"),
      vi.fn().mockReturnValue(saving),
      alwaysDiscard,
    );
    await useMarkdownViewer.getState().selectCard(card);
    useMarkdownViewer.getState().updateDraft("# Improve search (edited)");

    const savingCall = useMarkdownViewer.getState().save();

    expect(isCardSaving(useMarkdownViewer.getState(), card.path)).toBe(true);
    expect(isCardSaving(useMarkdownViewer.getState(), "other.md")).toBe(false);

    finishSave();
    await savingCall;

    expect(isCardSaving(useMarkdownViewer.getState(), card.path)).toBe(false);
  });

  it("keeps reporting the original card as saving after the viewer moves to another card", async () => {
    const card = makeCard();
    const otherCard = makeCard({
      path: "redesign-sidebar.md",
      absolutePath: "/board/redesign-sidebar.md",
    });
    let finishSave!: () => void;
    const saving = new Promise<void>((resolve) => {
      finishSave = resolve;
    });
    const useMarkdownViewer = createMarkdownViewerStore(
      () => Promise.resolve("# Improve search"),
      vi.fn().mockReturnValue(saving),
      alwaysDiscard,
    );
    await useMarkdownViewer.getState().selectCard(card);
    useMarkdownViewer.getState().updateDraft("# Improve search (edited)");

    const savingCall = useMarkdownViewer.getState().save();
    await useMarkdownViewer.getState().selectCard(otherCard);

    // The write for the first card is still on its way, so deleting its file
    // has to stay blocked even though the viewer now shows another card.
    expect(useMarkdownViewer.getState().selectedPath).toBe(otherCard.path);
    expect(isCardSaving(useMarkdownViewer.getState(), card.path)).toBe(true);

    finishSave();
    await savingCall;

    expect(isCardSaving(useMarkdownViewer.getState(), card.path)).toBe(false);
  });

  it("clears the saving marker after the viewer is closed mid-save", async () => {
    const card = makeCard();
    let finishSave!: () => void;
    const saving = new Promise<void>((resolve) => {
      finishSave = resolve;
    });
    const useMarkdownViewer = createMarkdownViewerStore(
      () => Promise.resolve("# Improve search"),
      vi.fn().mockReturnValue(saving),
      alwaysDiscard,
    );
    await useMarkdownViewer.getState().selectCard(card);
    useMarkdownViewer.getState().updateDraft("# Improve search (edited)");

    const savingCall = useMarkdownViewer.getState().save();
    useMarkdownViewer.getState().close();

    expect(isCardSaving(useMarkdownViewer.getState(), card.path)).toBe(true);

    finishSave();
    await savingCall;

    expect(isCardSaving(useMarkdownViewer.getState(), card.path)).toBe(false);
  });

  it("tracks concurrent writes to two cards independently", async () => {
    const card = makeCard();
    const otherCard = makeCard({
      path: "redesign-sidebar.md",
      absolutePath: "/board/redesign-sidebar.md",
    });
    let finishFirst!: () => void;
    let finishSecond!: () => void;
    const first = new Promise<void>((resolve) => {
      finishFirst = resolve;
    });
    const second = new Promise<void>((resolve) => {
      finishSecond = resolve;
    });
    const useMarkdownViewer = createMarkdownViewerStore(
      () => Promise.resolve("# Loaded"),
      vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second),
      alwaysDiscard,
    );
    await useMarkdownViewer.getState().selectCard(card);
    useMarkdownViewer.getState().updateDraft("# Improve search (edited)");
    const firstSave = useMarkdownViewer.getState().save();

    await useMarkdownViewer.getState().selectCard(otherCard);
    useMarkdownViewer.getState().updateDraft("# Redesign sidebar (edited)");
    const secondSave = useMarkdownViewer.getState().save();

    // Starting the second write must not lose track of the first: deleting
    // either file now would race a write that is still on its way.
    expect(isCardSaving(useMarkdownViewer.getState(), card.path)).toBe(true);
    expect(isCardSaving(useMarkdownViewer.getState(), otherCard.path)).toBe(
      true,
    );

    finishFirst();
    await firstSave;

    // The older write finishing clears only its own marker.
    expect(isCardSaving(useMarkdownViewer.getState(), card.path)).toBe(false);
    expect(isCardSaving(useMarkdownViewer.getState(), otherCard.path)).toBe(
      true,
    );

    finishSecond();
    await secondSave;

    expect(useMarkdownViewer.getState().savingPaths.size).toBe(0);
  });

  it("refuses a second concurrent write to the same card", async () => {
    const card = makeCard();
    const saveMarkdown = vi.fn().mockReturnValue(new Promise<void>(() => {}));
    const useMarkdownViewer = createMarkdownViewerStore(
      () => Promise.resolve("# Improve search"),
      saveMarkdown,
      alwaysDiscard,
    );
    await useMarkdownViewer.getState().selectCard(card);
    useMarkdownViewer.getState().updateDraft("# Improve search (edited)");

    void useMarkdownViewer.getState().save();
    await useMarkdownViewer.getState().save();

    expect(saveMarkdown).toHaveBeenCalledTimes(1);
  });

  it("leaves the viewer alone when a different card is discarded", async () => {
    const card = makeCard();
    const useMarkdownViewer = createMarkdownViewerStore(
      () => Promise.resolve("# Improve search"),
      vi.fn(),
      neverDiscard,
    );
    await useMarkdownViewer.getState().selectCard(card);
    useMarkdownViewer.getState().updateDraft("# Improve search (edited)");

    useMarkdownViewer.getState().discardCard("redesign-sidebar.md");

    expect(useMarkdownViewer.getState().selectedPath).toBe(card.path);
    expect(useMarkdownViewer.getState().draft).toBe(
      "# Improve search (edited)",
    );
  });
});
