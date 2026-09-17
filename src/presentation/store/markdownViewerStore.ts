import { create } from "zustand";
import type { StoreApi, UseBoundStore } from "zustand";
import type { Card } from "../../domain/card.ts";
import type { FileRevision } from "../../domain/fileSystemPort.ts";
import { UseCaseError } from "../../usecase/useCaseError.ts";
import { toUiError } from "../errors/toUiError.ts";

export type MarkdownStatus = "idle" | "loading" | "loaded" | "error";
export type MarkdownConflict = "changed" | "gone";

export interface MarkdownViewerState {
  selectedPath?: string;
  absolutePath?: string;
  status: MarkdownStatus;
  content?: string; // last saved/loaded content (baseline)
  revision?: FileRevision; // revision of the content baseline
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
  conflict?: MarkdownConflict;
  conflictResolutionError?: string;
  conflictResolution?: "reloading" | "overwriting";
  selectCard: (card: Card) => Promise<void>;
  updateDraft: (content: string) => void;
  save: () => Promise<void>;
  reloadFromDisk: () => Promise<void>;
  overwrite: () => Promise<void>;
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
  // Follows a card whose file was moved, keeping what is on screen. The draft
  // is deliberately preserved - the file moved, its contents did not - and
  // absolutePath has to move with it or the next save would write back to the
  // path the file just left and recreate it there.
  retargetCard: (previousPath: string, card: Card) => void;
}

export type ViewMarkdown = (
  path: string,
) => Promise<{ content: string; revision: FileRevision }>;
export type SaveMarkdown = (
  path: string,
  content: string,
  expectedRevision: FileRevision | undefined,
) => Promise<FileRevision>;
export type ConfirmDiscard = () => boolean;
export type ConfirmOverwrite = (conflict: MarkdownConflict) => boolean;

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
  revision: undefined,
  draft: undefined,
  error: undefined,
  saveError: undefined,
  conflict: undefined,
  conflictResolutionError: undefined,
  conflictResolution: undefined,
} as const satisfies Partial<MarkdownViewerState>;

export function createMarkdownViewerStore(
  viewMarkdown: ViewMarkdown,
  saveMarkdown: SaveMarkdown,
  confirmDiscard: ConfirmDiscard,
  confirmOverwrite: ConfirmOverwrite,
): UseBoundStore<StoreApi<MarkdownViewerState>> {
  // Identifies which selection/save the viewer is currently showing. Every
  // async result checks it before writing state back, so a load or save that
  // resolves after the viewer moved on - to another card, or to nothing at all
  // because the card was deleted - is dropped instead of reopening a viewer
  // the user already left.
  let generation = 0;

  return create<MarkdownViewerState>((set, get) => {
    async function loadMarkdown(
      selectedPath: string,
      absolutePath: string,
      mode: "select" | "reload",
    ): Promise<void> {
      const request = ++generation;
      if (mode === "select") {
        set({
          selectedPath,
          absolutePath,
          status: "loading",
          content: undefined,
          revision: undefined,
          draft: undefined,
          error: undefined,
          saveError: undefined,
          conflict: undefined,
          conflictResolutionError: undefined,
          conflictResolution: undefined,
        });
      } else {
        set({
          conflictResolution: "reloading",
          conflictResolutionError: undefined,
        });
      }

      try {
        const { content, revision } = await viewMarkdown(absolutePath);
        if (request !== generation) return;
        set({
          status: "loaded",
          content,
          revision,
          draft: content,
          error: undefined,
          saveError: undefined,
          conflict: undefined,
          conflictResolutionError: undefined,
          conflictResolution: undefined,
        });
      } catch (error) {
        if (request !== generation) return;
        if (mode === "select") {
          set({
            status: "error",
            error: toUiError(error).message,
          });
        } else {
          // A failed conflict reload must not compound the problem by losing
          // the draft the user was trying to protect.
          set({
            conflictResolutionError: toUiError(error).message,
            conflictResolution: undefined,
          });
        }
      }
    }

    async function persist(
      expectedRevision: FileRevision | undefined,
      resolution?: "overwriting",
    ) {
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
        ...(resolution
          ? {
            conflictResolution: resolution,
            conflictResolutionError: undefined,
          }
          : { saveError: undefined }),
      });
      try {
        const revision = await saveMarkdown(
          absolutePath,
          draft,
          expectedRevision,
        );
        if (request !== generation) return;
        set({
          content: draft,
          revision,
          saveError: undefined,
          conflict: undefined,
          conflictResolutionError: undefined,
          conflictResolution: undefined,
        });
      } catch (error) {
        if (request !== generation) return;
        if (resolution) {
          // A failed overwrite has not resolved the original conflict. Keep
          // that context visible and report this attempt separately.
          set({
            conflictResolutionError: toUiError(error).message,
            conflictResolution: undefined,
          });
        } else if (
          error instanceof UseCaseError && error.code === "markdown.conflict"
        ) {
          set({
            saveError: toUiError(error).message,
            conflict: "changed",
            conflictResolutionError: undefined,
            conflictResolution: undefined,
          });
        } else if (
          error instanceof UseCaseError && error.code === "markdown.file-gone"
        ) {
          set({
            saveError: toUiError(error).message,
            conflict: "gone",
            conflictResolutionError: undefined,
            conflictResolution: undefined,
          });
        } else {
          set({
            saveError: toUiError(error).message,
            conflictResolutionError: undefined,
            conflictResolution: undefined,
          });
        }
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
    }

    return {
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

        if (!card.absolutePath) {
          generation++;
          set({
            ...CLOSED_STATE,
            selectedPath: card.path,
            status: "error",
            error: "Could not resolve this card's file path.",
          });
          return;
        }

        await loadMarkdown(card.path, card.absolutePath, "select");
      },
      updateDraft: (content: string) => {
        set({ draft: content });
      },
      save: async () => {
        const { conflict, revision } = get();
        if (conflict) return;
        await persist(revision);
      },
      reloadFromDisk: async () => {
        const state = get();
        const {
          selectedPath,
          absolutePath,
          conflict,
          conflictResolution,
        } = state;
        if (
          conflict !== "changed" || conflictResolution || !selectedPath ||
          !absolutePath
        ) return;
        if (isMarkdownDirty(state) && !confirmDiscard()) return;
        await loadMarkdown(selectedPath, absolutePath, "reload");
      },
      overwrite: async () => {
        const { conflict, conflictResolution } = get();
        if (
          !conflict || conflictResolution || !confirmOverwrite(conflict)
        ) return;
        await persist(undefined, "overwriting");
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
      retargetCard: (previousPath: string, card: Card) => {
        // The rename flow only ever moves the card the viewer has open, but the
        // check is kept as the same defense line the other path-scoped actions
        // draw.
        if (get().selectedPath !== previousPath) return;
        // Content and its revision survive the move together: FileRevision's
        // contract keeps a token valid across a rename that leaves bytes
        // unchanged. The generation counter is left alone too: nothing is in
        // flight (the rename UI waits for a pending save), and bumping it would
        // throw away a result that belongs to this very file.
        set({ selectedPath: card.path, absolutePath: card.absolutePath });
      },
    };
  });
}
