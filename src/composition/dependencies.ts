import { DenoApplicationMenu } from "../infrastructure/denoApplicationMenu.ts";
import { DenoFileSystemAdapter } from "../infrastructure/denoFileSystemAdapter.ts";
import { YamlBoardRepository } from "../infrastructure/yamlBoardRepository.ts";
import { YamlConfigRepository } from "../infrastructure/yamlConfigRepository.ts";
import { getHomeDirectory, listDirectory } from "../usecase/browseDirectory.ts";
import { createBoard } from "../usecase/createBoard.ts";
import { createBoardDirectory } from "../usecase/createBoardDirectory.ts";
import { listRecentBoardEntries } from "../usecase/listRecentBoardEntries.ts";
import { listRecentBoards } from "../usecase/listRecentBoards.ts";
import { openBoard as openBoardUseCase } from "../usecase/openBoard.ts";
import { removeRecentBoard } from "../usecase/removeRecentBoard.ts";
import { saveBoard } from "../usecase/saveBoard.ts";
import { viewMarkdown } from "../usecase/viewMarkdown.ts";
import { saveMarkdown } from "../usecase/saveMarkdown.ts";
import { deleteMarkdown } from "../usecase/deleteMarkdown.ts";
import { createMarkdownCard } from "../usecase/createMarkdownCard.ts";
import { addExistingMarkdownCard } from "../usecase/addExistingMarkdownCard.ts";
import { relocateMarkdownCard } from "../usecase/relocateMarkdownCard.ts";
import { recreateMarkdownCard } from "../usecase/recreateMarkdownCard.ts";
import { readCardContents } from "../usecase/readCardContents.ts";
import { renameMarkdownCard } from "../usecase/renameMarkdownCard.ts";
import type {
  AppDependencies,
  BoardSession,
} from "../presentation/context/appContext.ts";
import { createBoardStore } from "../presentation/store/boardStore.ts";
import { createFilterStore } from "../presentation/store/filterStore.ts";
import { createMarkdownViewerStore } from "../presentation/store/markdownViewerStore.ts";
import { createNewBoardDialogStore } from "../presentation/store/newBoardDialogStore.ts";
import { createPaneLayoutStore } from "../presentation/store/paneLayoutStore.ts";
import { createRecentBoardsStore } from "../presentation/store/recentBoardsStore.ts";
import { createWorkspaceStore } from "../presentation/store/workspaceStore.ts";

const fileSystem = new DenoFileSystemAdapter();
const boardRepository = new YamlBoardRepository(fileSystem);
const configRepository = new YamlConfigRepository(fileSystem);
const applicationMenu = new DenoApplicationMenu(fileSystem);

async function refreshRecentMenu(): Promise<void> {
  try {
    await applicationMenu.setRecentBoards(
      await listRecentBoards({ configRepository }),
    );
  } catch (error) {
    console.warn("Failed to refresh the application menu:", error);
  }
}

function createBoardSession(): BoardSession {
  return {
    boardStore: createBoardStore({
      openBoard: async (path) => {
        const loadedBoard = await openBoardUseCase(path, {
          boardRepository,
          configRepository,
        });
        // Best-effort: the menu rebuild must never block opening the board.
        void refreshRecentMenu();
        return loadedBoard;
      },
      saveBoard: (path, board, expectedRevision) =>
        saveBoard(path, board, expectedRevision, { boardRepository }),
      createMarkdownCard: (input) => createMarkdownCard(input, { fileSystem }),
      addExistingMarkdownCard: (input) =>
        addExistingMarkdownCard(input, { fileSystem }),
      relocateMarkdownCard: (input) =>
        relocateMarkdownCard(input, { fileSystem }),
      recreateMarkdownCard: (input) =>
        recreateMarkdownCard(input, { fileSystem }),
      renameMarkdownCard: (input) => renameMarkdownCard(input, { fileSystem }),
      createBoard: (input) =>
        createBoard(input, { fileSystem, boardRepository }),
      deleteMarkdown: (path) => deleteMarkdown(path, { fileSystem }),
      confirmDiscardBoard: () =>
        confirm(
          "Discard changes made in Facet and reload the board from disk?",
        ),
      confirmOverwriteBoard: () =>
        confirm(
          "Overwrite changes made outside Facet? The board shown in Facet will replace them.",
        ),
    }),
    filterStore: createFilterStore(),
    markdownViewer: createMarkdownViewerStore(
      (path) => viewMarkdown(path, { fileSystem }),
      (path, content, expectedRevision) =>
        saveMarkdown(path, content, expectedRevision, { fileSystem }),
      () => confirm("Discard unsaved changes to this Markdown file?"),
      (conflict) =>
        confirm(
          conflict === "gone"
            ? "Recreate this Markdown file at its previous path? The draft shown in Facet will be written there."
            : "Overwrite changes made outside Facet? The draft shown in Facet will replace them.",
        ),
    ),
  };
}

export const appDependencies: AppDependencies = {
  cardContentReading: {
    read: (cards) => readCardContents(cards, { fileSystem }),
  },
  directoryBrowsing: {
    listDirectory: (path) => listDirectory(path, { fileSystem }),
    homeDirectory: () => getHomeDirectory({ fileSystem }),
    createDirectory: (parentDirectory, name) =>
      createBoardDirectory(parentDirectory, name, { fileSystem }),
  },
  newBoardDialog: createNewBoardDialogStore(),
  paneLayout: createPaneLayoutStore(),
  recentBoards: createRecentBoardsStore({
    list: () => listRecentBoardEntries({ configRepository, boardRepository }),
    remove: async (path) => {
      await removeRecentBoard(path, { configRepository });
      void refreshRecentMenu();
    },
  }),
  workspace: createWorkspaceStore({
    createSession: createBoardSession,
    confirmCloseBoard: () =>
      confirm("Discard unsaved changes to this board and close it?"),
  }),
};

// Called once at startup (outside React) to set the initial menu and wire
// native menu clicks to the stores.
export function startApplicationMenu(): void {
  void refreshRecentMenu();
  applicationMenu.onMenuSelect({
    // Only opens the dialog; the unsaved-draft confirmation happens at
    // submit time (in NewBoardDialog), so cancelling the dialog never
    // discards a draft as a side effect.
    newBoard: () => appDependencies.newBoardDialog.getState().open(),
    openRecent: (path) => appDependencies.workspace.getState().openBoard(path),
  });
}
