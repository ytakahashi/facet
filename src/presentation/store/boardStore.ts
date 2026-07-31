import { create } from "zustand";
import type { StoreApi, UseBoundStore } from "zustand";
import type { Board, CardLocation } from "../../domain/board.ts";
import {
  addCard as addCardDomain,
  addColumn as addColumnDomain,
  addLabelDefinition as addLabelDefinitionDomain,
  addLabelToCard as addLabelToCardDomain,
  CardAlreadyExistsError,
  containsCardPath,
  findCardByPath,
  findLabelDefinition,
  LabelAlreadyExistsError,
  moveCard as moveCardDomain,
  moveColumn as moveColumnDomain,
  removeCard as removeCardDomain,
  removeColumn as removeColumnDomain,
  removeLabelDefinition as removeLabelDefinitionDomain,
  removeLabelFromCard as removeLabelFromCardDomain,
  renameBoard as renameBoardDomain,
  renameColumn as renameColumnDomain,
  renameLabelDefinition as renameLabelDefinitionDomain,
  replaceCard as replaceCardDomain,
  setCardPriority as setCardPriorityDomain,
  setCardTitle as setCardTitleDomain,
  setLabelColor as setLabelColorDomain,
} from "../../domain/board.ts";
import type { Card } from "../../domain/card.ts";
import type { LabelColor } from "../../domain/label.ts";
import type { Priority } from "../../domain/priority.ts";
import {
  CardFileValidationError,
  resolveExistingMarkdownPath,
  resolveNewMarkdownPath,
} from "../../domain/cardFile.ts";
import type { AddExistingMarkdownCardInput } from "../../usecase/addExistingMarkdownCard.ts";
import type { CreateBoardInput } from "../../usecase/createBoard.ts";
import type { CreateMarkdownCardInput } from "../../usecase/createMarkdownCard.ts";
import type { RelocateMarkdownCardInput } from "../../usecase/relocateMarkdownCard.ts";
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
  createBoard: (input: CreateBoardInput) => Promise<void>;
  moveCard: (from: CardLocation, to: CardLocation) => void;
  moveColumn: (columnId: string, toIndex: number) => void;
  addColumn: (name: string) => void;
  renameBoard: (name: string) => void;
  renameColumn: (columnId: string, name: string) => void;
  removeColumn: (columnId: string) => void;
  renameCard: (path: string, title: string) => void;
  setCardPriority: (path: string, priority: Priority | undefined) => void;
  addCardLabel: (path: string, labelName: string) => void;
  removeCardLabel: (path: string, labelName: string) => void;
  createLabel: (name: string, color: LabelColor) => void;
  renameLabel: (name: string, nextName: string) => void;
  setLabelColor: (name: string, color: LabelColor) => void;
  removeLabel: (name: string) => void;
  addNewCard: (input: NewCardInput) => Promise<Card>;
  addExistingCard: (input: ExistingCardInput) => Promise<Card>;
  relocateCard: (cardPath: string, absolutePath: string) => Promise<Card>;
  removeCard: (path: string, options: RemoveCardOptions) => Promise<void>;
  retrySave: () => void;
}

export interface NewCardInput {
  columnId: string;
  directory: string;
  fileName: string;
  title: string;
}

export interface ExistingCardInput {
  columnId: string;
  absolutePath: string;
}

export interface RemoveCardOptions {
  deleteFile: boolean;
}

export type OpenBoard = (path: string) => Promise<Board>;
export type CreateBoard = (input: CreateBoardInput) => Promise<string>;
export type { SaveBoard };
export type CreateMarkdownCard = (
  input: CreateMarkdownCardInput,
) => Promise<Card>;
export type AddExistingMarkdownCard = (
  input: AddExistingMarkdownCardInput,
) => Promise<Card>;
export type RelocateMarkdownCard = (
  input: RelocateMarkdownCardInput,
) => Promise<Card>;
export type DeleteMarkdown = (path: string) => Promise<void>;

// Named rather than positional: the store keeps gaining file-touching use
// cases, and a list of same-shaped function arguments stops being readable at
// the call site long before it stops type-checking.
export interface BoardStoreDeps {
  openBoard: OpenBoard;
  saveBoard: SaveBoard;
  createMarkdownCard: CreateMarkdownCard;
  addExistingMarkdownCard: AddExistingMarkdownCard;
  relocateMarkdownCard: RelocateMarkdownCard;
  createBoard: CreateBoard;
  deleteMarkdown: DeleteMarkdown;
}

export function createBoardStore({
  openBoard,
  saveBoard,
  createMarkdownCard,
  addExistingMarkdownCard,
  relocateMarkdownCard,
  createBoard,
  deleteMarkdown,
}: BoardStoreDeps): UseBoundStore<StoreApi<BoardState>> {
  return create<BoardState>((set, get) => {
    const saveQueue = createBoardSaveQueue(saveBoard, {
      onSaving: () => set({ isSaving: true, saveError: undefined }),
      onSaved: () => set({ isSaving: false }),
      onError: (error) =>
        set({ isSaving: false, saveError: toUiError(error).message }),
    });

    function appendCard(
      boardPath: string,
      columnId: string,
      card: Card,
    ): Card {
      const current = get();
      if (!current.board || current.path !== boardPath) {
        throw new UseCaseError("card.board-changed");
      }
      let nextBoard: Board;
      try {
        nextBoard = addCardDomain(current.board, columnId, card);
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
    }

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
      createBoard: async (input: CreateBoardInput) => {
        const path = await createBoard(input);
        // Opening through the regular openBoard path records the board in
        // the recent history and reads the just-written file back, so a
        // file that cannot be loaded again surfaces immediately.
        await get().openBoard(path);
      },
      moveCard: (from: CardLocation, to: CardLocation) => {
        const { board, path } = get();
        if (!board || !path) return;
        const nextBoard = moveCardDomain(board, from, to);
        set({ board: nextBoard });
        saveQueue.save(path, nextBoard);
      },
      moveColumn: (columnId: string, toIndex: number) => {
        const { board, path } = get();
        if (!board || !path) return;
        // The dragged id comes from the DOM, so an unknown column is guarded
        // here rather than left to throw from the domain layer.
        if (!board.columns.some((column) => column.id === columnId)) return;
        const nextBoard = moveColumnDomain(board, columnId, toIndex);
        // Dropping a column back into its own slot leaves the row untouched;
        // don't rewrite the board file for it.
        const isUnchanged = nextBoard.columns.every((column, index) =>
          column === board.columns[index]
        );
        if (isUnchanged) return;
        set({ board: nextBoard });
        saveQueue.save(path, nextBoard);
      },
      addColumn: (name: string) => {
        const { board, path } = get();
        if (!board || !path) return;
        const trimmedName = name.trim();
        // The AddColumn form disables submit for blank names; this guard is a
        // defense line, so it silently no-ops instead of surfacing an error.
        if (trimmedName === "") return;
        // A column id only has to be unique within the board; readable
        // hand-written ids in existing YAML stay valid alongside these.
        // Generated here rather than in the domain layer to keep domain
        // functions free of randomness. crypto.randomUUID needs a secure
        // context, which the localhost-served webview qualifies as.
        const nextBoard = addColumnDomain(board, {
          id: crypto.randomUUID(),
          name: trimmedName,
          cards: [],
        });
        set({ board: nextBoard });
        saveQueue.save(path, nextBoard);
      },
      renameBoard: (name: string) => {
        const { board, path } = get();
        if (!board || !path) return;
        const trimmedName = name.trim();
        // The inline rename UI reverts blank input instead of submitting it;
        // this guard is a defense line, so it silently no-ops.
        if (trimmedName === "") return;
        if (board.name === trimmedName) return;
        const nextBoard = renameBoardDomain(board, trimmedName);
        set({ board: nextBoard });
        saveQueue.save(path, nextBoard);
      },
      renameColumn: (columnId: string, name: string) => {
        const { board, path } = get();
        if (!board || !path) return;
        const trimmedName = name.trim();
        // The inline rename UI reverts blank input instead of submitting it;
        // this guard is a defense line, so it silently no-ops.
        if (trimmedName === "") return;
        const column = board.columns.find((c) => c.id === columnId);
        if (column && column.name === trimmedName) return;
        const nextBoard = renameColumnDomain(board, columnId, trimmedName);
        set({ board: nextBoard });
        saveQueue.save(path, nextBoard);
      },
      removeColumn: (columnId: string) => {
        const { board, path } = get();
        if (!board || !path) return;
        // The delete action is disabled for non-empty columns; this guard is
        // a defense line, so it silently no-ops.
        const column = board.columns.find((c) => c.id === columnId);
        if (column && column.cards.length > 0) return;
        const nextBoard = removeColumnDomain(board, columnId);
        set({ board: nextBoard });
        saveQueue.save(path, nextBoard);
      },
      renameCard: (cardPath: string, title: string) => {
        const { board, path } = get();
        if (!board || !path) return;
        const trimmedTitle = title.trim();
        // The inline rename UI reverts blank input instead of submitting it;
        // this guard is a defense line, so it silently no-ops.
        if (trimmedTitle === "") return;
        // MarkdownViewer only exposes the rename UI for a card it resolved
        // via findCardByPath, but path is caller-supplied, so an unknown
        // path is guarded here rather than left to throw from the domain
        // layer.
        const card = findCardByPath(board, cardPath);
        if (!card || card.displayTitle === trimmedTitle) return;
        const nextBoard = setCardTitleDomain(board, cardPath, trimmedTitle);
        set({ board: nextBoard });
        saveQueue.save(path, nextBoard);
      },
      setCardPriority: (cardPath: string, priority: Priority | undefined) => {
        const { board, path } = get();
        if (!board || !path) return;
        // PriorityPicker only exposes the picker for a card it resolved via
        // findCardByPath, but path is caller-supplied, so an unknown path is
        // guarded here rather than left to throw from the domain layer.
        const card = findCardByPath(board, cardPath);
        if (!card || card.priority === priority) return;
        const nextBoard = setCardPriorityDomain(board, cardPath, priority);
        set({ board: nextBoard });
        saveQueue.save(path, nextBoard);
      },
      addCardLabel: (cardPath: string, labelName: string) => {
        const { board, path } = get();
        if (!board || !path) return;
        // LabelPickerDialog only offers labels from the registry and only
        // toggles a checkbox to its opposite state; these guards are a
        // defense line against a stale card/registry reference rather than
        // input this store expects to validate.
        const card = findCardByPath(board, cardPath);
        if (!card || card.labels.includes(labelName)) return;
        if (!findLabelDefinition(board, labelName)) return;
        const nextBoard = addLabelToCardDomain(board, cardPath, labelName);
        set({ board: nextBoard });
        saveQueue.save(path, nextBoard);
      },
      removeCardLabel: (cardPath: string, labelName: string) => {
        const { board, path } = get();
        if (!board || !path) return;
        const card = findCardByPath(board, cardPath);
        if (!card || !card.labels.includes(labelName)) return;
        const nextBoard = removeLabelFromCardDomain(
          board,
          cardPath,
          labelName,
        );
        set({ board: nextBoard });
        saveQueue.save(path, nextBoard);
      },
      createLabel: (name: string, color: LabelColor) => {
        const { board, path } = get();
        if (!board || !path) return;
        const trimmedName = name.trim();
        // The create form disables submit for blank names; this guard is a
        // defense line, so it silently no-ops instead of surfacing an error.
        if (trimmedName === "") return;
        let nextBoard: Board;
        try {
          nextBoard = addLabelDefinitionDomain(board, {
            name: trimmedName,
            color,
          });
        } catch (cause) {
          if (cause instanceof LabelAlreadyExistsError) {
            throw new UseCaseError(
              "label.already-exists",
              { name: trimmedName },
              { cause },
            );
          }
          throw cause;
        }
        set({ board: nextBoard });
        saveQueue.save(path, nextBoard);
      },
      renameLabel: (name: string, nextName: string) => {
        const { board, path } = get();
        if (!board || !path) return;
        const trimmedNextName = nextName.trim();
        // The inline rename UI reverts blank input instead of submitting it;
        // this guard is a defense line, so it silently no-ops.
        if (trimmedNextName === "" || trimmedNextName === name) return;
        let nextBoard: Board;
        try {
          nextBoard = renameLabelDefinitionDomain(
            board,
            name,
            trimmedNextName,
          );
        } catch (cause) {
          if (cause instanceof LabelAlreadyExistsError) {
            throw new UseCaseError(
              "label.already-exists",
              { name: trimmedNextName },
              { cause },
            );
          }
          throw cause;
        }
        set({ board: nextBoard });
        saveQueue.save(path, nextBoard);
      },
      setLabelColor: (name: string, color: LabelColor) => {
        const { board, path } = get();
        if (!board || !path) return;
        const label = findLabelDefinition(board, name);
        if (!label || label.color === color) return;
        const nextBoard = setLabelColorDomain(board, name, color);
        set({ board: nextBoard });
        saveQueue.save(path, nextBoard);
      },
      removeLabel: (name: string) => {
        const { board, path } = get();
        if (!board || !path) return;
        const nextBoard = removeLabelDefinitionDomain(board, name);
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

        return appendCard(initial.path, input.columnId, card);
      },
      addExistingCard: async (input: ExistingCardInput) => {
        const initial = get();
        if (!initial.board || !initial.path) {
          throw new Error("Open a board before adding a card.");
        }

        let target: ReturnType<typeof resolveExistingMarkdownPath>;
        try {
          target = resolveExistingMarkdownPath(
            initial.path,
            input.absolutePath,
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

        const card = await addExistingMarkdownCard({
          boardPath: initial.path,
          absolutePath: input.absolutePath,
        });
        return appendCard(initial.path, input.columnId, card);
      },
      relocateCard: async (cardPath: string, absolutePath: string) => {
        const initial = get();
        if (!initial.board || !initial.path) {
          // Invariant violation, not a recoverable user error: the repair
          // dialog only exists on a card rendered from an open board.
          throw new Error("Open a board before relocating a card.");
        }
        // MissingCardDialog resolved this card from the board, so an unknown
        // path means the board has moved on since it opened.
        const card = findCardByPath(initial.board, cardPath);
        if (!card) {
          throw new UseCaseError("card.board-changed");
        }

        // Read first: a failure here must leave the board exactly as it was,
        // with the card still pointing at the path the user has not fixed yet.
        // No duplicate-path check before this - unlike creating a card, this
        // only reads, so running it before the check costs nothing.
        const repaired = await relocateMarkdownCard({
          boardPath: initial.path,
          card,
          absolutePath,
        });

        const current = get();
        if (!current.board || current.path !== initial.path) {
          // The native menu stays clickable while a modal dialog is open, so
          // Open Recent can swap the board mid-repair.
          throw new UseCaseError("card.board-changed");
        }
        let nextBoard: Board;
        try {
          nextBoard = replaceCardDomain(current.board, cardPath, repaired);
        } catch (cause) {
          if (cause instanceof CardAlreadyExistsError) {
            throw new UseCaseError(
              "card.already-on-board",
              { path: repaired.path },
              { cause },
            );
          }
          throw cause;
        }
        set({ board: nextBoard });
        saveQueue.save(current.path, nextBoard);
        return repaired;
      },
      removeCard: async (
        cardPath: string,
        { deleteFile }: RemoveCardOptions,
      ) => {
        const initial = get();
        if (!initial.board || !initial.path) {
          // Invariant violation, not a recoverable user error: the delete
          // action only exists on a card rendered from an open board.
          throw new Error("Open a board before deleting a card.");
        }
        // DeleteCardDialog resolved this card from the board, so an unknown
        // path means it is already gone - the caller's goal is met either way.
        const card = findCardByPath(initial.board, cardPath);
        if (!card) return;

        if (deleteFile) {
          if (!card.absolutePath) {
            // Invariant violation: the dialog disables the file option for a
            // card whose path never resolved inside the board directory.
            throw new Error(`Card path is not resolvable: ${cardPath}`);
          }
          // The file goes first: if this fails the board keeps the card, which
          // still points at a file that is still there, so the state matches
          // exactly what it was before. The other order would drop the last
          // reference to a file that failed to delete.
          await deleteMarkdown(card.absolutePath);
        }

        const current = get();
        if (!current.board || current.path !== initial.path) {
          // The native menu stays clickable while a modal dialog is open, so
          // Open Recent can swap the board mid-delete.
          throw new UseCaseError("card.board-changed");
        }
        const nextBoard = removeCardDomain(current.board, cardPath);
        set({ board: nextBoard });
        saveQueue.save(current.path, nextBoard);
      },
      retrySave: () => {
        const { board, path } = get();
        if (board && path) saveQueue.save(path, board);
      },
    };
  });
}
