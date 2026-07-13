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

describe("createMarkdownViewerStore", () => {
  it("moves to loaded with the file's content once viewMarkdown resolves", async () => {
    const card = makeCard();
    const useMarkdownViewer = createMarkdownViewerStore(() =>
      Promise.resolve("# Improve search")
    );

    await useMarkdownViewer.getState().selectCard(card);

    expect(useMarkdownViewer.getState().status).toBe("loaded");
    expect(useMarkdownViewer.getState().selectedPath).toBe(card.path);
    expect(useMarkdownViewer.getState().content).toBe("# Improve search");
  });

  it("moves to error with the failure message when viewMarkdown rejects", async () => {
    const card = makeCard();
    const useMarkdownViewer = createMarkdownViewerStore(() =>
      Promise.reject(new Error("file not found"))
    );

    await useMarkdownViewer.getState().selectCard(card);

    expect(useMarkdownViewer.getState().status).toBe("error");
    expect(useMarkdownViewer.getState().error).toBe("file not found");
  });

  it("moves to error without calling viewMarkdown when the card has no absolute path", async () => {
    const card = makeCard({ absolutePath: undefined });
    const viewMarkdown = vi.fn();
    const useMarkdownViewer = createMarkdownViewerStore(viewMarkdown);

    await useMarkdownViewer.getState().selectCard(card);

    expect(useMarkdownViewer.getState().status).toBe("error");
    expect(viewMarkdown).not.toHaveBeenCalled();
  });

  it("resets to idle with no selection or content when closed", async () => {
    const card = makeCard();
    const useMarkdownViewer = createMarkdownViewerStore(() =>
      Promise.resolve("# Improve search")
    );
    await useMarkdownViewer.getState().selectCard(card);

    useMarkdownViewer.getState().close();

    expect(useMarkdownViewer.getState().status).toBe("idle");
    expect(useMarkdownViewer.getState().selectedPath).toBeUndefined();
    expect(useMarkdownViewer.getState().content).toBeUndefined();
  });
});
