import { describe, expect, it, vi } from "vitest";
import type { Card } from "../../domain/card.ts";
import { createMarkdownViewerStore } from "./markdownViewerStore.ts";

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    path: "improve-search.md",
    absolutePath: "/board/improve-search.md",
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

  it("moves to error with the failure message when viewMarkdown rejects", async () => {
    const card = makeCard();
    const useMarkdownViewer = createMarkdownViewerStore(
      () => Promise.reject(new Error("file not found")),
      vi.fn(),
      alwaysDiscard,
    );

    await useMarkdownViewer.getState().selectCard(card);

    expect(useMarkdownViewer.getState().status).toBe("error");
    expect(useMarkdownViewer.getState().error).toBe("file not found");
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

    useMarkdownViewer.getState().close();

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
    expect(useMarkdownViewer.getState().isSaving).toBe(false);
  });

  it("keeps the draft and reports an error when saving fails", async () => {
    const card = makeCard();
    const saveMarkdown = vi.fn().mockRejectedValue(new Error("disk full"));
    const useMarkdownViewer = createMarkdownViewerStore(
      () => Promise.resolve("# Improve search"),
      saveMarkdown,
      alwaysDiscard,
    );
    await useMarkdownViewer.getState().selectCard(card);
    useMarkdownViewer.getState().updateDraft("# Improve search (edited)");

    await useMarkdownViewer.getState().save();

    expect(useMarkdownViewer.getState().saveError).toBe("disk full");
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

    useMarkdownViewer.getState().close();

    expect(useMarkdownViewer.getState().status).toBe("loaded");
    expect(useMarkdownViewer.getState().draft).toBe(
      "# Improve search (edited)",
    );
  });
});
