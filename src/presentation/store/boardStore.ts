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
  moveLabelDefinition,
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
import type { FileRevision } from "../../domain/fileSystemPort.ts";
import type { LabelColor } from "../../domain/label.ts";
import type { Priority } from "../../domain/priority.ts";
import {
  CardFileValidationError,
  resolveExistingMarkdownPath,
  resolveNewMarkdownPath,
  resolveNewMarkdownPathAt,
} from "../../domain/cardFile.ts";
import { isSameCardPath, normalizeCardPath } from "../../domain/boardPath.ts";
import type { AddExistingMarkdownCardInput } from "../../usecase/addExistingMarkdownCard.ts";
import type { CreateBoardInput } from "../../usecase/createBoard.ts";
import type { CreateMarkdownCardInput } from "../../usecase/createMarkdownCard.ts";
import type { RelocateMarkdownCardInput } from "../../usecase/relocateMarkdownCard.ts";
import type { RecreateMarkdownCardInput } from "../../usecase/recreateMarkdownCard.ts";
import type { RenameMarkdownCardInput } from "../../usecase/renameMarkdownCard.ts";
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
  saveConflict: boolean;
  conflictResolutionError?: string;
  conflictResolution?: "reloading" | "overwriting";
  openBoard: (path: string) => Promise<void>;
  createBoard: (input: CreateBoardInput) => Promise<string>;
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
  moveLabel: (name: string, toIndex: number) => void;
  addNewCard: (input: NewCardInput) => Promise<Card>;
  addExistingCard: (input: ExistingCardInput) => Promise<Card>;
  relocateCard: (cardPath: string, absolutePath: string) => Promise<Card>;
  recreateCard: (
    cardPath: string,
    absolutePath: string,
    title: string,
  ) => Promise<Card>;
  // Named for the file, not the card: renameCard changes the card's title.
  renameCardFile: (
    cardPath: string,
    directory: string,
    fileName: string,
  ) => Promise<Card>;
  removeCard: (path: string, options: RemoveCardOptions) => Promise<void>;
  retrySave: () => void;
  reloadBoard: () => Promise<void>;
  overwriteBoard: () => void;
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

export type OpenBoard = (
  path: string,
) => Promise<{ board: Board; revision: FileRevision }>;
export type CreateBoard = (input: CreateBoardInput) => Promise<string>;
export type SaveBoard = (
  path: string,
  board: Board,
  expectedRevision: FileRevision | undefined,
) => Promise<FileRevision>;
export type BoardDiscardReason = "reload";
export type ConfirmDiscardBoard = (reason: BoardDiscardReason) => boolean;
export type ConfirmOverwriteBoard = () => boolean;
export type CreateMarkdownCard = (
  input: CreateMarkdownCardInput,
) => Promise<Card>;
export type AddExistingMarkdownCard = (
  input: AddExistingMarkdownCardInput,
) => Promise<Card>;
export type RelocateMarkdownCard = (
  input: RelocateMarkdownCardInput,
) => Promise<Card>;
export type RecreateMarkdownCard = (
  input: RecreateMarkdownCardInput,
) => Promise<Card>;
export type RenameMarkdownCard = (
  input: RenameMarkdownCardInput,
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
  recreateMarkdownCard: RecreateMarkdownCard;
  renameMarkdownCard: RenameMarkdownCard;
  createBoard: CreateBoard;
  deleteMarkdown: DeleteMarkdown;
  confirmDiscardBoard: ConfirmDiscardBoard;
  confirmOverwriteBoard: ConfirmOverwriteBoard;
}

export function createBoardStore({
  openBoard,
  saveBoard,
  createMarkdownCard,
  addExistingMarkdownCard,
  relocateMarkdownCard,
  recreateMarkdownCard,
  renameMarkdownCard,
  createBoard,
  deleteMarkdown,
  confirmDiscardBoard,
  confirmOverwriteBoard,
}: BoardStoreDeps): UseBoundStore<StoreApi<BoardState>> {
  return create<BoardState>((set, get) => {
    // The workspace uses one store per board, but this store's public openBoard
    // operation can still change its path. Keep revisions per path so a late
    // save cannot supply another path's next conditional write.
    const revisions = new Map<string, FileRevision>();
    const conflictedPaths = new Set<string>();
    const overwritingPaths = new Set<string>();
    let activeSavePath: string | undefined;
    let activeSaveIsOverwrite = false;
    let loadGeneration = 0;

    const saveQueue = createBoardSaveQueue(async (path, board) => {
      activeSavePath = path;
      activeSaveIsOverwrite = overwritingPaths.has(path);
      if (conflictedPaths.has(path)) return;
      try {
        const revision = await saveBoard(path, board, revisions.get(path));
        revisions.set(path, revision);
        if (activeSaveIsOverwrite) {
          overwritingPaths.delete(path);
          if (get().path === path) {
            set({
              saveConflict: false,
              saveError: undefined,
              conflictResolutionError: undefined,
              conflictResolution: undefined,
            });
          }
        }
      } catch (error) {
        // A failed unconditional overwrite has not resolved the conflict, so
        // later optimistic edits must remain blocked from automatic saving.
        if (
          activeSaveIsOverwrite ||
          (error instanceof UseCaseError && error.code === "board.conflict")
        ) {
          conflictedPaths.add(path);
        }
        if (activeSaveIsOverwrite) overwritingPaths.delete(path);
        throw error;
      }
    }, {
      onSaving: () =>
        set((state) => ({
          isSaving: true,
          saveError: state.saveConflict ? state.saveError : undefined,
          conflictResolutionError: state.saveConflict
            ? state.conflictResolutionError
            : undefined,
        })),
      onSaved: () => set({ isSaving: false }),
      onError: (error) => {
        if (get().path !== activeSavePath) {
          set({ isSaving: false });
          return;
        }
        if (activeSaveIsOverwrite) {
          set({
            isSaving: false,
            saveConflict: true,
            conflictResolutionError: toUiError(error).message,
            conflictResolution: undefined,
          });
          return;
        }
        set({
          isSaving: false,
          saveError: toUiError(error).message,
          saveConflict: error instanceof UseCaseError &&
            error.code === "board.conflict",
          conflictResolutionError: undefined,
          conflictResolution: undefined,
        });
      },
    });

    function queueSave(path: string, board: Board): void {
      if (conflictedPaths.has(path)) return;
      saveQueue.save(path, board);
    }

    async function loadBoard(
      path: string,
      mode: "open" | "reload",
    ): Promise<void> {
      const request = ++loadGeneration;
      if (mode === "open") {
        set({
          status: "loading",
          error: undefined,
          conflictResolution: undefined,
          conflictResolutionError: undefined,
        });
      } else {
        set({
          conflictResolution: "reloading",
          conflictResolutionError: undefined,
        });
      }
      try {
        const { board, revision } = await openBoard(path);
        if (request !== loadGeneration) return;
        revisions.set(path, revision);
        conflictedPaths.delete(path);
        set({
          status: "loaded",
          board,
          path,
          saveConflict: false,
          saveError: undefined,
          conflictResolutionError: undefined,
          conflictResolution: undefined,
          error: undefined,
        });
      } catch (error) {
        if (request !== loadGeneration) return;
        if (mode === "open") {
          set({ status: "error", error: toUiError(error).message });
        } else {
          // A failed reload must leave the optimistic board available for a
          // later retry or overwrite instead of replacing it with an error
          // screen and losing the only remaining copy of those edits.
          set({
            conflictResolutionError: toUiError(error).message,
            conflictResolution: undefined,
          });
        }
      }
    }

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
      queueSave(current.path, nextBoard);
      return card;
    }

    // The tail every repair shares: the card was resolved from the board
    // before the file I/O, so the board is re-read here to see whether it
    // still is the one that was repaired.
    function replaceCard(
      boardPath: string,
      cardPath: string,
      card: Card,
    ): Card {
      const current = get();
      if (!current.board || current.path !== boardPath) {
        // The workspace keeps a session on one path. This guard also covers
        // direct store use that changes the path during the file operation.
        throw new UseCaseError("card.board-changed");
      }
      let nextBoard: Board;
      try {
        nextBoard = replaceCardDomain(current.board, cardPath, card);
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
      queueSave(current.path, nextBoard);
      return card;
    }

    return {
      status: "empty",
      isSaving: false,
      saveConflict: false,
      openBoard: async (path: string) => {
        await loadBoard(path, "open");
      },
      createBoard: async (input: CreateBoardInput) => {
        const path = await createBoard(input);
        // Opening the created file also records it in recent boards. Return
        // its path even if that read fails so the workspace can show an error
        // tab for a file that now exists on disk.
        await loadBoard(path, "open");
        return path;
      },
      moveCard: (from: CardLocation, to: CardLocation) => {
        const { board, path } = get();
        if (!board || !path) return;
        const nextBoard = moveCardDomain(board, from, to);
        set({ board: nextBoard });
        queueSave(path, nextBoard);
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
        queueSave(path, nextBoard);
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
        queueSave(path, nextBoard);
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
        queueSave(path, nextBoard);
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
        queueSave(path, nextBoard);
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
        queueSave(path, nextBoard);
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
        queueSave(path, nextBoard);
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
        queueSave(path, nextBoard);
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
        queueSave(path, nextBoard);
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
        queueSave(path, nextBoard);
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
        queueSave(path, nextBoard);
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
        queueSave(path, nextBoard);
      },
      setLabelColor: (name: string, color: LabelColor) => {
        const { board, path } = get();
        if (!board || !path) return;
        const label = findLabelDefinition(board, name);
        if (!label || label.color === color) return;
        const nextBoard = setLabelColorDomain(board, name, color);
        set({ board: nextBoard });
        queueSave(path, nextBoard);
      },
      removeLabel: (name: string) => {
        const { board, path } = get();
        if (!board || !path) return;
        const nextBoard = removeLabelDefinitionDomain(board, name);
        set({ board: nextBoard });
        queueSave(path, nextBoard);
      },
      moveLabel: (name: string, toIndex: number) => {
        const { board, path } = get();
        if (!board || !path) return;
        if (!board.labels.some((label) => label.name === name)) return;
        const nextBoard = moveLabelDefinition(board, name, toIndex);
        if (
          nextBoard.labels.every((label, index) =>
            label === board.labels[index]
          )
        ) return;
        set({ board: nextBoard });
        queueSave(path, nextBoard);
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

        return replaceCard(initial.path, cardPath, repaired);
      },
      recreateCard: async (
        cardPath: string,
        absolutePath: string,
        title: string,
      ) => {
        const initial = get();
        if (!initial.board || !initial.path) {
          throw new Error("Open a board before relocating a card.");
        }
        const card = findCardByPath(initial.board, cardPath);
        if (!card) {
          throw new UseCaseError("card.board-changed");
        }

        let target: ReturnType<typeof resolveNewMarkdownPathAt>;
        try {
          target = resolveNewMarkdownPathAt(initial.path, absolutePath);
        } catch (cause) {
          if (cause instanceof CardFileValidationError) {
            throw cardFileValidationToUseCaseError(cause);
          }
          throw cause;
        }
        // Checked before the file is written, the way adding a card is: the
        // repair would fail at replaceCard anyway, but only after leaving a
        // file behind that no card on the board refers to. The card's own path
        // is not a collision - writing the file it is missing is the point.
        if (
          !isSameCardPath(target.relativePath, card.path) &&
          containsCardPath(initial.board, target.relativePath)
        ) {
          throw new UseCaseError("card.already-on-board", {
            path: target.relativePath,
          });
        }

        const repaired = await recreateMarkdownCard({
          boardPath: initial.path,
          card,
          absolutePath,
          title,
        });

        return replaceCard(initial.path, cardPath, repaired);
      },
      renameCardFile: async (
        cardPath: string,
        directory: string,
        fileName: string,
      ) => {
        const initial = get();
        if (!initial.board || !initial.path) {
          // Invariant violation, not a recoverable user error: the rename
          // dialog only exists on a card the viewer has open, which requires a
          // loaded board.
          throw new Error("Open a board before moving a card's file.");
        }
        const card = findCardByPath(initial.board, cardPath);
        if (!card) {
          throw new UseCaseError("card.board-changed");
        }

        let target: ReturnType<typeof resolveNewMarkdownPath>;
        try {
          target = resolveNewMarkdownPath(initial.path, directory, fileName);
        } catch (cause) {
          if (cause instanceof CardFileValidationError) {
            throw cardFileValidationToUseCaseError(cause);
          }
          throw cause;
        }
        // Submitting the path the card already has asks for nothing; don't
        // move a file onto itself or rewrite the board file for it. A change
        // of letter case is not the same path - it goes on and is renamed.
        if (
          normalizeCardPath(target.relativePath) ===
            normalizeCardPath(card.path)
        ) {
          return card;
        }
        // Checked before the file moves, the way creating one is: replaceCard
        // would reject the collision anyway, but only after the file had
        // already left the path the board still points at. The board's own
        // uniqueness cannot be read off the file system - the card occupying
        // the path may itself be missing its file.
        // The card's own path is not a collision: re-spelling this file's name
        // is the point of the operation.
        if (
          !isSameCardPath(target.relativePath, card.path) &&
          containsCardPath(initial.board, target.relativePath)
        ) {
          throw new UseCaseError("card.already-on-board", {
            path: target.relativePath,
          });
        }

        const moved = await renameMarkdownCard({
          boardPath: initial.path,
          card,
          directory,
          fileName,
        });

        return replaceCard(initial.path, cardPath, moved);
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
          // The workspace keeps a session on one path. This guard also covers
          // direct store use that changes the path during file I/O.
          throw new UseCaseError("card.board-changed");
        }
        const nextBoard = removeCardDomain(current.board, cardPath);
        set({ board: nextBoard });
        queueSave(current.path, nextBoard);
      },
      retrySave: () => {
        const { board, path, saveConflict } = get();
        if (board && path && !saveConflict) queueSave(path, board);
      },
      reloadBoard: async () => {
        const { path, saveConflict, isSaving, conflictResolution } = get();
        if (
          !path || !saveConflict || isSaving || conflictResolution ||
          !confirmDiscardBoard("reload")
        ) return;
        await loadBoard(path, "reload");
      },
      overwriteBoard: () => {
        const { board, path, saveConflict, isSaving, conflictResolution } =
          get();
        if (
          !board || !path || !saveConflict || isSaving || conflictResolution ||
          !confirmOverwriteBoard()
        ) {
          return;
        }
        conflictedPaths.delete(path);
        revisions.delete(path);
        overwritingPaths.add(path);
        set({
          conflictResolution: "overwriting",
          conflictResolutionError: undefined,
        });
        queueSave(path, board);
      },
    };
  });
}
