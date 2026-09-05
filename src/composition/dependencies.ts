import { DenoApplicationMenu } from "../infrastructure/denoApplicationMenu.ts";
import { DenoFileSystemAdapter } from "../infrastructure/denoFileSystemAdapter.ts";
import { YamlBoardRepository } from "../infrastructure/yamlBoardRepository.ts";
import { YamlConfigRepository } from "../infrastructure/yamlConfigRepository.ts";
import { getHomeDirectory, listDirectory } from "../usecase/browseDirectory.ts";
import { createBoard } from "../usecase/createBoard.ts";
import { createBoardDirectory } from "../usecase/createBoardDirectory.ts";
import { listRecentBoards } from "../usecase/listRecentBoards.ts";
import { openBoard as openBoardUseCase } from "../usecase/openBoard.ts";
import { saveBoard } from "../usecase/saveBoard.ts";
import { viewMarkdown } from "../usecase/viewMarkdown.ts";
import { saveMarkdown } from "../usecase/saveMarkdown.ts";
import { deleteMarkdown } from "../usecase/deleteMarkdown.ts";
import { createMarkdownCard } from "../usecase/createMarkdownCard.ts";
import { addExistingMarkdownCard } from "../usecase/addExistingMarkdownCard.ts";
import { relocateMarkdownCard } from "../usecase/relocateMarkdownCard.ts";
import { recreateMarkdownCard } from "../usecase/recreateMarkdownCard.ts";
import { renameMarkdownCard } from "../usecase/renameMarkdownCard.ts";
import type { AppDependencies } from "../presentation/context/appContext.ts";
import { createBoardStore } from "../presentation/store/boardStore.ts";
import { createFilterStore } from "../presentation/store/filterStore.ts";
import { createMarkdownViewerStore } from "../presentation/store/markdownViewerStore.ts";
import { createNewBoardDialogStore } from "../presentation/store/newBoardDialogStore.ts";
import { createPaneLayoutStore } from "../presentation/store/paneLayoutStore.ts";

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

export const appDependencies: AppDependencies = {
  boardStore: createBoardStore({
    openBoard: async (path) => {
      const board = await openBoardUseCase(path, {
        boardRepository,
        configRepository,
      });
      // Best-effort: the menu rebuild must never block opening the board.
      void refreshRecentMenu();
      return board;
    },
    saveBoard: (path, board) => saveBoard(path, board, { boardRepository }),
    createMarkdownCard: (input) => createMarkdownCard(input, { fileSystem }),
    addExistingMarkdownCard: (input) =>
      addExistingMarkdownCard(input, { fileSystem }),
    relocateMarkdownCard: (input) =>
      relocateMarkdownCard(input, { fileSystem }),
    recreateMarkdownCard: (input) =>
      recreateMarkdownCard(input, { fileSystem }),
    renameMarkdownCard: (input) => renameMarkdownCard(input, { fileSystem }),
    createBoard: (input) => createBoard(input, { fileSystem, boardRepository }),
    deleteMarkdown: (path) => deleteMarkdown(path, { fileSystem }),
  }),
  directoryBrowsing: {
    listDirectory: (path) => listDirectory(path, { fileSystem }),
    homeDirectory: () => getHomeDirectory({ fileSystem }),
    createDirectory: (parentDirectory, name) =>
      createBoardDirectory(parentDirectory, name, { fileSystem }),
  },
  filterStore: createFilterStore(),
  markdownViewer: createMarkdownViewerStore(
    (path) => viewMarkdown(path, { fileSystem }),
    (path, content) => saveMarkdown(path, content, { fileSystem }),
    () => confirm("Discard unsaved changes to this Markdown file?"),
  ),
  newBoardDialog: createNewBoardDialogStore(),
  paneLayout: createPaneLayoutStore(),
  recentBoards: {
    list: () => listRecentBoards({ configRepository }),
  },
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
    openRecent: (path) => {
      // Abort the switch if the user declines to discard an unsaved draft.
      if (!appDependencies.markdownViewer.getState().close()) {
        return;
      }
      void appDependencies.boardStore.getState().openBoard(path);
    },
  });
}
