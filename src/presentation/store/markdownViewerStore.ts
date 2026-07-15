import { create } from "zustand";
import type { StoreApi, UseBoundStore } from "zustand";
import type { Card } from "../../domain/card.ts";

export type MarkdownStatus = "idle" | "loading" | "loaded" | "error";

export interface MarkdownViewerState {
  selectedPath?: string;
  absolutePath?: string;
  status: MarkdownStatus;
  content?: string; // last saved/loaded content (baseline)
  draft?: string; // current textarea value
  error?: string; // load error
  isSaving: boolean;
  saveError?: string;
  selectCard: (card: Card) => Promise<void>;
  updateDraft: (content: string) => void;
  save: () => Promise<void>;
  // Returns whether the viewer was actually closed, so a caller that's about
  // to replace the whole board (e.g. switching boards from the menu) can
  // abort the switch when the user declines to discard unsaved changes.
  close: () => boolean;
}

export type ViewMarkdown = (path: string) => Promise<string>;
export type SaveMarkdown = (path: string, content: string) => Promise<void>;
export type ConfirmDiscard = () => boolean;

function isDirty(state: Pick<MarkdownViewerState, "draft" | "content">) {
  return state.draft !== undefined && state.draft !== state.content;
}

export function createMarkdownViewerStore(
  viewMarkdown: ViewMarkdown,
  saveMarkdown: SaveMarkdown,
  confirmDiscard: ConfirmDiscard,
): UseBoundStore<StoreApi<MarkdownViewerState>> {
  return create<MarkdownViewerState>((set, get) => ({
    status: "idle",
    isSaving: false,
    selectCard: async (card: Card) => {
      const state = get();
      if (card.path === state.selectedPath) {
        return;
      }
      if (isDirty(state) && !confirmDiscard()) {
        return;
      }

      set({
        selectedPath: card.path,
        absolutePath: card.absolutePath,
        status: "loading",
        content: undefined,
        draft: undefined,
        error: undefined,
        saveError: undefined,
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
        set({ status: "loaded", content, draft: content });
      } catch (error) {
        set({
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    updateDraft: (content: string) => {
      set({ draft: content });
    },
    save: async () => {
      const { absolutePath, draft } = get();
      if (!absolutePath || draft === undefined) {
        return;
      }

      set({ isSaving: true, saveError: undefined });
      try {
        await saveMarkdown(absolutePath, draft);
        set({ isSaving: false, content: draft });
      } catch (error) {
        set({
          isSaving: false,
          saveError: error instanceof Error ? error.message : String(error),
        });
      }
    },
    close: () => {
      const state = get();
      if (isDirty(state) && !confirmDiscard()) {
        return false;
      }

      set({
        selectedPath: undefined,
        absolutePath: undefined,
        status: "idle",
        content: undefined,
        draft: undefined,
        error: undefined,
        saveError: undefined,
      });
      return true;
    },
  }));
}
