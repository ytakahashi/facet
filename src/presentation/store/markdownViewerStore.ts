import { create } from "zustand";
import type { StoreApi, UseBoundStore } from "zustand";
import type { Card } from "../../domain/card.ts";
import { toUiError } from "../errors/toUiError.ts";

export type MarkdownStatus = "idle" | "loading" | "loaded" | "error";

export interface MarkdownViewerState {
  selectedPath?: string;
  absolutePath?: string;
  status: MarkdownStatus;
  content?: string; // last saved/loaded content (baseline)
  draft?: string; // current textarea value
  error?: string; // load error
  // Card paths whose writes are currently in flight. Tracked apart from
  // selectedPath because the viewer can move to another card - or close
  // entirely - while a write is still on its way, and anything about to delete
  // that file has to be able to see the write coming.
  // A set rather than a single path: the user can save one card, move to
  // another and save that one too while the first write is still running, and
  // forgetting the first would let its file be deleted out from under a write
  // that then recreates it.
  savingPaths: ReadonlySet<string>;
  saveError?: string;
  selectCard: (card: Card) => Promise<void>;
  updateDraft: (content: string) => void;
  save: () => Promise<void>;
  // Returns whether the viewer was actually closed, so a caller that's about
  // to replace the whole board (e.g. switching boards from the menu) can
  // abort the switch when the user declines to discard unsaved changes.
  close: () => boolean;
  // Resets the viewer without the discard prompt, for a card that no longer
  // exists. The caller has already confirmed a destructive action on it, and
  // when its file was deleted, leaving the editor open would let Save recreate
  // the file. The path argument limits this to the card actually deleted - the
  // delete can start from any card on the board, not just the open one.
  discardCard: (path: string) => void;
}

export type ViewMarkdown = (path: string) => Promise<string>;
export type SaveMarkdown = (path: string, content: string) => Promise<void>;
export type ConfirmDiscard = () => boolean;

// Exported because "has the draft diverged from what is on disk" is asked
// outside this store too - the viewer's Save button and the delete dialog's
// warning both need it, and all three must agree on the answer.
export function isMarkdownDirty(
  state: Pick<MarkdownViewerState, "draft" | "content">,
): boolean {
  return state.draft !== undefined && state.draft !== state.content;
}

// Whether a write for this specific card is still in flight. Deleting the file
// while one is pending would let the write land afterwards and recreate the
// file the user just deleted, so the delete flow blocks on this rather than
// racing it. Answered from savingPaths, not from what the viewer happens to be
// showing: the delete can start from any card on the board, and the viewer may
// well have moved off the card whose write is still running.
export function isCardSaving(
  state: Pick<MarkdownViewerState, "savingPaths">,
  path: string,
): boolean {
  return state.savingPaths.has(path);
}

// Deliberately omits savingPaths: closing the viewer does not call off a write
// that is already on its way, so the marker has to outlive the card's presence
// on screen and is cleared by whichever save owns it.
const CLOSED_STATE = {
  selectedPath: undefined,
  absolutePath: undefined,
  status: "idle",
  content: undefined,
  draft: undefined,
  error: undefined,
  saveError: undefined,
} as const satisfies Partial<MarkdownViewerState>;

export function createMarkdownViewerStore(
  viewMarkdown: ViewMarkdown,
  saveMarkdown: SaveMarkdown,
  confirmDiscard: ConfirmDiscard,
): UseBoundStore<StoreApi<MarkdownViewerState>> {
  // Identifies which selection/save the viewer is currently showing. Every
  // async result checks it before writing state back, so a load or save that
  // resolves after the viewer moved on - to another card, or to nothing at all
  // because the card was deleted - is dropped instead of reopening a viewer
  // the user already left.
  let generation = 0;

  return create<MarkdownViewerState>((set, get) => ({
    status: "idle",
    savingPaths: new Set<string>(),
    selectCard: async (card: Card) => {
      const state = get();
      if (card.path === state.selectedPath) {
        return;
      }
      if (isMarkdownDirty(state) && !confirmDiscard()) {
        return;
      }

      const request = ++generation;
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
        if (request !== generation) return;
        set({ status: "loaded", content, draft: content });
      } catch (error) {
        if (request !== generation) return;
        set({
          status: "error",
          error: toUiError(error).message,
        });
      }
    },
    updateDraft: (content: string) => {
      set({ draft: content });
    },
    save: async () => {
      const { selectedPath, absolutePath, draft, savingPaths } = get();
      if (!selectedPath || !absolutePath || draft === undefined) {
        return;
      }
      // The Save button is already disabled while this card's write runs; this
      // guard keeps a second write off the same file whatever calls save().
      if (savingPaths.has(selectedPath)) {
        return;
      }

      const request = ++generation;
      set({
        savingPaths: new Set(savingPaths).add(selectedPath),
        saveError: undefined,
      });
      try {
        await saveMarkdown(absolutePath, draft);
        if (request !== generation) return;
        set({ content: draft });
      } catch (error) {
        if (request !== generation) return;
        set({ saveError: toUiError(error).message });
      } finally {
        // Cleared even when the viewer has moved past this result: the write
        // is over either way, and a marker left behind would keep the card
        // undeletable and its Save button disabled forever. Each save only
        // ever removes its own path, so concurrent saves cannot clear one
        // another.
        const remaining = new Set(get().savingPaths);
        remaining.delete(selectedPath);
        set({ savingPaths: remaining });
      }
    },
    close: () => {
      const state = get();
      if (isMarkdownDirty(state) && !confirmDiscard()) {
        return false;
      }

      generation++;
      set(CLOSED_STATE);
      return true;
    },
    discardCard: (path: string) => {
      if (get().selectedPath !== path) return;
      generation++;
      set(CLOSED_STATE);
    },
  }));
}
