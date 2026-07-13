import { create } from "zustand";
import type { StoreApi, UseBoundStore } from "zustand";
import type { Card } from "../../domain/card.ts";

export type MarkdownStatus = "idle" | "loading" | "loaded" | "error";

export interface MarkdownViewerState {
  selectedPath?: string;
  status: MarkdownStatus;
  content?: string;
  error?: string;
  selectCard: (card: Card) => Promise<void>;
  close: () => void;
}

export type ViewMarkdown = (path: string) => Promise<string>;

export function createMarkdownViewerStore(
  viewMarkdown: ViewMarkdown,
): UseBoundStore<StoreApi<MarkdownViewerState>> {
  return create<MarkdownViewerState>((set) => ({
    status: "idle",
    selectCard: async (card: Card) => {
      set({
        selectedPath: card.path,
        status: "loading",
        content: undefined,
        error: undefined,
      });

      if (!card.absolutePath) {
        set({
          status: "error",
          error: "Could not resolve this card's file path.",
        });
        return;
      }

      try {
        const content = await viewMarkdown(card.absolutePath);
        set({ status: "loaded", content });
      } catch (error) {
        set({
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    close: () => {
      set({
        selectedPath: undefined,
        status: "idle",
        content: undefined,
        error: undefined,
      });
    },
  }));
}
