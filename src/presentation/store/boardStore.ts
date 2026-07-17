import { create } from "zustand";
import type { StoreApi, UseBoundStore } from "zustand";
import type { Board, CardLocation } from "../../domain/board.ts";
import {
  addCard as addCardDomain,
  CardAlreadyExistsError,
  containsCardPath,
  moveCard as moveCardDomain,
} from "../../domain/board.ts";
import type { Card } from "../../domain/card.ts";
import {
  CardFileValidationError,
  resolveNewMarkdownPath,
} from "../../domain/cardFile.ts";
import type { CreateMarkdownCardInput } from "../../usecase/createMarkdownCard.ts";
import type { SaveBoard } from "../../usecase/boardSaveQueue.ts";
import { createBoardSaveQueue } from "../../usecase/boardSaveQueue.ts";
import {
  cardFileValidationToUseCaseError,
  UseCaseError,
} from "../../usecase/useCaseError.ts";
import { toUiError } from "../errors/toUiError.ts";

export type BoardStatus = "empty" | "loading" | "loaded" | "error";

export interface BoardState {
  status: BoardStatus;
  board?: Board;
  path?: string;
  error?: string;
  isSaving: boolean;
  saveError?: string;
  openBoard: (path: string) => Promise<void>;
  moveCard: (from: CardLocation, to: CardLocation) => void;
  addNewCard: (input: NewCardInput) => Promise<Card>;
  retrySave: () => void;
}

export interface NewCardInput {
  columnId: string;
  directory: string;
  fileName: string;
  title: string;
}

export type OpenBoard = (path: string) => Promise<Board>;
export type { SaveBoard };
export type CreateMarkdownCard = (
  input: CreateMarkdownCardInput,
) => Promise<Card>;

export function createBoardStore(
  openBoard: OpenBoard,
  saveBoard: SaveBoard,
  createMarkdownCard: CreateMarkdownCard,
): UseBoundStore<StoreApi<BoardState>> {
  return create<BoardState>((set, get) => {
    const saveQueue = createBoardSaveQueue(saveBoard, {
      onSaving: () => set({ isSaving: true, saveError: undefined }),
      onSaved: () => set({ isSaving: false }),
      onError: (error) =>
        set({ isSaving: false, saveError: toUiError(error).message }),
    });

    return {
      status: "empty",
      isSaving: false,
      openBoard: async (path: string) => {
        set({ status: "loading", error: undefined });
        try {
          const board = await openBoard(path);
          set({ status: "loaded", board, path });
        } catch (error) {
          set({
            status: "error",
            error: toUiError(error).message,
          });
        }
      },
      moveCard: (from: CardLocation, to: CardLocation) => {
        const { board, path } = get();
        if (!board || !path) return;
        const nextBoard = moveCardDomain(board, from, to);
        set({ board: nextBoard });
        saveQueue.save(path, nextBoard);
      },
      addNewCard: async (input: NewCardInput) => {
        const initial = get();
        if (!initial.board || !initial.path) {
          // Invariant violation, not a recoverable user error: AddCardDialog
          // is only ever mounted once a board is open (see KanbanBoard.tsx).
          throw new Error("Open a board before adding a card.");
        }

        let target: ReturnType<typeof resolveNewMarkdownPath>;
        try {
          target = resolveNewMarkdownPath(
            initial.path,
            input.directory,
            input.fileName,
          );
        } catch (cause) {
          if (cause instanceof CardFileValidationError) {
            throw cardFileValidationToUseCaseError(cause);
          }
          throw cause;
        }
        if (containsCardPath(initial.board, target.relativePath)) {
          throw new UseCaseError("card.already-on-board", {
            path: target.relativePath,
          });
        }

        const card = await createMarkdownCard({
          boardPath: initial.path,
          directory: input.directory,
          fileName: input.fileName,
          title: input.title,
        });

        const current = get();
        if (!current.board || current.path !== initial.path) {
          throw new UseCaseError("card.board-changed");
        }
        let nextBoard: Board;
        try {
          nextBoard = addCardDomain(current.board, input.columnId, card);
        } catch (cause) {
          if (cause instanceof CardAlreadyExistsError) {
            throw new UseCaseError(
              "card.already-on-board",
              { path: card.path },
              { cause },
            );
          }
          throw cause;
        }
        set({ board: nextBoard });
        saveQueue.save(current.path, nextBoard);
        return card;
      },
      retrySave: () => {
        const { board, path } = get();
        if (board && path) saveQueue.save(path, board);
      },
    };
  });
}
