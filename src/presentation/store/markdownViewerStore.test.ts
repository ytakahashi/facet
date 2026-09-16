import { describe, expect, it, vi } from "vitest";
import type { Card } from "../../domain/card.ts";
import { UseCaseError } from "../../usecase/useCaseError.ts";
import { toUiError } from "../errors/toUiError.ts";
import {
  createMarkdownViewerStore as createMarkdownViewerStoreImplementation,
  isCardSaving,
} from "./markdownViewerStore.ts";

function createMarkdownViewerStore(
  viewMarkdown: (
    path: string,
  ) => Promise<string | { content: string; revision: string }>,
  saveMarkdown: (
    path: string,
    content: string,
    expectedRevision?: string,
  ) => Promise<string | void>,
  confirmDiscard: Parameters<
    typeof createMarkdownViewerStoreImplementation
  >[2],
  confirmOverwrite: Parameters<
    typeof createMarkdownViewerStoreImplementation
  >[3] = alwaysOverwrite,
) {
  return createMarkdownViewerStoreImplementation(
    async (path) => {
      const result = await viewMarkdown(path);
      return typeof result === "string"
        ? { content: result, revision: "revision-1" }
        : result;
    },
    async (path, content, expectedRevision) =>
      (await saveMarkdown(path, content, expectedRevision)) ?? "revision-2",
    confirmDiscard,
    confirmOverwrite,
  );
}

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

function alwaysOverwrite() {
  return true;
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
    expect(useMarkdownViewer.getState().revision).toBe("revision-1");
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
      "revision-1",
    );
    expect(useMarkdownViewer.getState().content).toBe(
      "# Improve search (edited)",
    );
    expect(useMarkdownViewer.getState().revision).toBe("revision-2");
    expect(isCardSaving(useMarkdownViewer.getState(), card.path)).toBe(false);
  });

  it("uses the revision returned by one save for the next save", async () => {
    const card = makeCard();
    const saveMarkdown = vi.fn()
      .mockResolvedValueOnce("revision-2")
      .mockResolvedValueOnce("revision-3");
    const useMarkdownViewer = createMarkdownViewerStore(
      () => Promise.resolve("# Improve search"),
      saveMarkdown,
      alwaysDiscard,
    );
    await useMarkdownViewer.getState().selectCard(card);

    useMarkdownViewer.getState().updateDraft("# First edit");
    await useMarkdownViewer.getState().save();
    useMarkdownViewer.getState().updateDraft("# Second edit");
    await useMarkdownViewer.getState().save();

    expect(saveMarkdown).toHaveBeenNthCalledWith(
      1,
      "/board/improve-search.md",
      "# First edit",
      "revision-1",
    );
    expect(saveMarkdown).toHaveBeenNthCalledWith(
      2,
      "/board/improve-search.md",
      "# Second edit",
      "revision-2",
    );
    expect(useMarkdownViewer.getState().revision).toBe("revision-3");
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

  it("keeps its baseline and draft when the file changed outside Facet", async () => {
    const card = makeCard();
    const conflictError = new UseCaseError("markdown.conflict", {
      path: "/board/improve-search.md",
    });
    const saveMarkdown = vi.fn().mockRejectedValue(conflictError);
    const useMarkdownViewer = createMarkdownViewerStore(
      () => Promise.resolve("# Improve search"),
      saveMarkdown,
      alwaysDiscard,
    );
    await useMarkdownViewer.getState().selectCard(card);
    useMarkdownViewer.getState().updateDraft("# Facet edit");

    await useMarkdownViewer.getState().save();

    expect(useMarkdownViewer.getState()).toMatchObject({
      conflict: "changed",
      content: "# Improve search",
      draft: "# Facet edit",
      revision: "revision-1",
      saveError: toUiError(conflictError).message,
    });

    await useMarkdownViewer.getState().save();
    expect(saveMarkdown).toHaveBeenCalledTimes(1);
  });

  it("reports a missing file separately and does not try to reload it", async () => {
    const card = makeCard();
    const fileGoneError = new UseCaseError("markdown.file-gone", {
      path: "/board/improve-search.md",
    });
    const viewMarkdown = vi.fn().mockResolvedValue("# Improve search");
    const useMarkdownViewer = createMarkdownViewerStore(
      viewMarkdown,
      vi.fn().mockRejectedValue(fileGoneError),
      alwaysDiscard,
    );
    await useMarkdownViewer.getState().selectCard(card);
    useMarkdownViewer.getState().updateDraft("# Facet edit");
    await useMarkdownViewer.getState().save();

    await useMarkdownViewer.getState().reloadFromDisk();

    expect(useMarkdownViewer.getState().conflict).toBe("gone");
    expect(useMarkdownViewer.getState().draft).toBe("# Facet edit");
    expect(viewMarkdown).toHaveBeenCalledTimes(1);
  });

  it("keeps the draft when conflict reload confirmation is declined", async () => {
    const card = makeCard();
    const viewMarkdown = vi.fn().mockResolvedValue("# Improve search");
    const confirmDiscard = vi.fn(neverDiscard);
    const useMarkdownViewer = createMarkdownViewerStore(
      viewMarkdown,
      vi.fn().mockRejectedValue(
        new UseCaseError("markdown.conflict", {
          path: "/board/improve-search.md",
        }),
      ),
      confirmDiscard,
    );
    await useMarkdownViewer.getState().selectCard(card);
    useMarkdownViewer.getState().updateDraft("# Facet edit");
    await useMarkdownViewer.getState().save();

    await useMarkdownViewer.getState().reloadFromDisk();

    expect(confirmDiscard).toHaveBeenCalledTimes(1);
    expect(viewMarkdown).toHaveBeenCalledTimes(1);
    expect(useMarkdownViewer.getState()).toMatchObject({
      content: "# Improve search",
      draft: "# Facet edit",
      revision: "revision-1",
      conflict: "changed",
    });
  });

  it("reloads an externally changed file and replaces the draft and revision", async () => {
    const card = makeCard();
    const viewMarkdown = vi.fn()
      .mockResolvedValueOnce({
        content: "# Improve search",
        revision: "revision-1",
      })
      .mockResolvedValueOnce({
        content: "# External edit",
        revision: "revision-external",
      });
    const useMarkdownViewer = createMarkdownViewerStore(
      viewMarkdown,
      vi.fn().mockRejectedValue(
        new UseCaseError("markdown.conflict", {
          path: "/board/improve-search.md",
        }),
      ),
      alwaysDiscard,
    );
    await useMarkdownViewer.getState().selectCard(card);
    useMarkdownViewer.getState().updateDraft("# Facet edit");
    await useMarkdownViewer.getState().save();

    await useMarkdownViewer.getState().reloadFromDisk();

    expect(useMarkdownViewer.getState()).toMatchObject({
      content: "# External edit",
      draft: "# External edit",
      revision: "revision-external",
    });
    expect(useMarkdownViewer.getState().conflict).toBeUndefined();
    expect(useMarkdownViewer.getState().saveError).toBeUndefined();
  });

  it("keeps the draft and conflict when reloading from disk fails", async () => {
    const card = makeCard();
    const loadError = new UseCaseError("markdown.load-failed", {
      path: "/board/improve-search.md",
    });
    const viewMarkdown = vi.fn()
      .mockResolvedValueOnce("# Improve search")
      .mockRejectedValueOnce(loadError);
    const useMarkdownViewer = createMarkdownViewerStore(
      viewMarkdown,
      vi.fn().mockRejectedValue(
        new UseCaseError("markdown.conflict", {
          path: "/board/improve-search.md",
        }),
      ),
      alwaysDiscard,
    );
    await useMarkdownViewer.getState().selectCard(card);
    useMarkdownViewer.getState().updateDraft("# Facet edit");
    await useMarkdownViewer.getState().save();

    await useMarkdownViewer.getState().reloadFromDisk();

    expect(useMarkdownViewer.getState()).toMatchObject({
      status: "loaded",
      content: "# Improve search",
      draft: "# Facet edit",
      revision: "revision-1",
      conflict: "changed",
      saveError: toUiError(loadError).message,
    });
  });

  it("stays closed when a conflict reload resolves after the viewer closes", async () => {
    const card = makeCard();
    let finishReload!: (
      value: { content: string; revision: string },
    ) => void;
    const reloading = new Promise<{ content: string; revision: string }>(
      (resolve) => {
        finishReload = resolve;
      },
    );
    const viewMarkdown = vi.fn()
      .mockResolvedValueOnce("# Improve search")
      .mockReturnValueOnce(reloading);
    const useMarkdownViewer = createMarkdownViewerStore(
      viewMarkdown,
      vi.fn().mockRejectedValue(
        new UseCaseError("markdown.conflict", {
          path: "/board/improve-search.md",
        }),
      ),
      alwaysDiscard,
    );
    await useMarkdownViewer.getState().selectCard(card);
    useMarkdownViewer.getState().updateDraft("# Facet edit");
    await useMarkdownViewer.getState().save();

    const reload = useMarkdownViewer.getState().reloadFromDisk();
    useMarkdownViewer.getState().close();
    finishReload({ content: "# External edit", revision: "revision-2" });
    await reload;

    expect(useMarkdownViewer.getState().status).toBe("idle");
    expect(useMarkdownViewer.getState().selectedPath).toBeUndefined();
    expect(useMarkdownViewer.getState().draft).toBeUndefined();
    expect(useMarkdownViewer.getState().revision).toBeUndefined();
  });

  it("overwrites without a revision after confirmation and resumes guarded saves", async () => {
    const card = makeCard();
    const conflictError = new UseCaseError("markdown.conflict", {
      path: "/board/improve-search.md",
    });
    const saveMarkdown = vi.fn()
      .mockRejectedValueOnce(conflictError)
      .mockResolvedValueOnce("revision-2")
      .mockResolvedValueOnce("revision-3");
    const confirmOverwrite = vi.fn(() => true);
    const useMarkdownViewer = createMarkdownViewerStore(
      () => Promise.resolve("# Improve search"),
      saveMarkdown,
      alwaysDiscard,
      confirmOverwrite,
    );
    await useMarkdownViewer.getState().selectCard(card);
    useMarkdownViewer.getState().updateDraft("# Facet edit");
    await useMarkdownViewer.getState().save();

    await useMarkdownViewer.getState().overwrite();

    expect(confirmOverwrite).toHaveBeenCalledWith("changed");
    expect(saveMarkdown).toHaveBeenNthCalledWith(
      2,
      "/board/improve-search.md",
      "# Facet edit",
      undefined,
    );
    expect(useMarkdownViewer.getState()).toMatchObject({
      content: "# Facet edit",
      revision: "revision-2",
    });
    expect(useMarkdownViewer.getState().conflict).toBeUndefined();

    useMarkdownViewer.getState().updateDraft("# Next edit");
    await useMarkdownViewer.getState().save();
    expect(saveMarkdown).toHaveBeenNthCalledWith(
      3,
      "/board/improve-search.md",
      "# Next edit",
      "revision-2",
    );
  });

  it("does not overwrite when confirmation is declined", async () => {
    const card = makeCard();
    const saveMarkdown = vi.fn().mockRejectedValue(
      new UseCaseError("markdown.file-gone", {
        path: "/board/improve-search.md",
      }),
    );
    const confirmOverwrite = vi.fn(() => false);
    const useMarkdownViewer = createMarkdownViewerStore(
      () => Promise.resolve("# Improve search"),
      saveMarkdown,
      alwaysDiscard,
      confirmOverwrite,
    );
    await useMarkdownViewer.getState().selectCard(card);
    useMarkdownViewer.getState().updateDraft("# Facet edit");
    await useMarkdownViewer.getState().save();

    await useMarkdownViewer.getState().overwrite();

    expect(confirmOverwrite).toHaveBeenCalledWith("gone");
    expect(saveMarkdown).toHaveBeenCalledTimes(1);
    expect(useMarkdownViewer.getState().conflict).toBe("gone");
    expect(useMarkdownViewer.getState().draft).toBe("# Facet edit");
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
    expect(useMarkdownViewer.getState().revision).toBe("revision-1");
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

  it("follows a moved card without disturbing what is on screen", async () => {
    const card = makeCard();
    const useMarkdownViewer = createMarkdownViewerStore(
      () => Promise.resolve("# Improve search"),
      vi.fn(),
      neverDiscard,
    );
    await useMarkdownViewer.getState().selectCard(card);
    useMarkdownViewer.getState().updateDraft("# Improve search (edited)");

    useMarkdownViewer.getState().retargetCard(
      card.path,
      makeCard({
        path: "ideas/search.md",
        absolutePath: "/board/ideas/search.md",
      }),
    );

    expect(useMarkdownViewer.getState().selectedPath).toBe("ideas/search.md");
    expect(useMarkdownViewer.getState().absolutePath).toBe(
      "/board/ideas/search.md",
    );
    expect(useMarkdownViewer.getState().status).toBe("loaded");
    expect(useMarkdownViewer.getState().content).toBe("# Improve search");
    expect(useMarkdownViewer.getState().draft).toBe(
      "# Improve search (edited)",
    );
    expect(useMarkdownViewer.getState().revision).toBe("revision-1");
  });

  it("saves to the new path after following a moved card", async () => {
    const card = makeCard();
    const saveMarkdown = vi.fn().mockResolvedValue(undefined);
    const useMarkdownViewer = createMarkdownViewerStore(
      () => Promise.resolve("# Improve search"),
      saveMarkdown,
      neverDiscard,
    );
    await useMarkdownViewer.getState().selectCard(card);
    useMarkdownViewer.getState().updateDraft("# Improve search (edited)");
    useMarkdownViewer.getState().retargetCard(
      card.path,
      makeCard({
        path: "ideas/search.md",
        absolutePath: "/board/ideas/search.md",
      }),
    );

    await useMarkdownViewer.getState().save();

    // The point of following the move: writing to the old path would put the
    // file back where it was just taken from.
    expect(saveMarkdown).toHaveBeenCalledWith(
      "/board/ideas/search.md",
      "# Improve search (edited)",
      "revision-1",
    );
    expect(useMarkdownViewer.getState().content).toBe(
      "# Improve search (edited)",
    );
  });

  it("leaves the viewer alone when a different card is retargeted", async () => {
    const card = makeCard();
    const useMarkdownViewer = createMarkdownViewerStore(
      () => Promise.resolve("# Improve search"),
      vi.fn(),
      neverDiscard,
    );
    await useMarkdownViewer.getState().selectCard(card);

    useMarkdownViewer.getState().retargetCard(
      "redesign-sidebar.md",
      makeCard({
        path: "ideas/search.md",
        absolutePath: "/board/ideas/search.md",
      }),
    );

    expect(useMarkdownViewer.getState().selectedPath).toBe(card.path);
    expect(useMarkdownViewer.getState().absolutePath).toBe(card.absolutePath);
  });
});
