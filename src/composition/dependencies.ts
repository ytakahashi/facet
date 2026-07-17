import { DenoApplicationMenu } from "../infrastructure/denoApplicationMenu.ts";
import { DenoFileSystemAdapter } from "../infrastructure/denoFileSystemAdapter.ts";
import { YamlBoardRepository } from "../infrastructure/yamlBoardRepository.ts";
import { YamlConfigRepository } from "../infrastructure/yamlConfigRepository.ts";
import { getHomeDirectory, listDirectory } from "../usecase/browseDirectory.ts";
import { createBoardDirectory } from "../usecase/createBoardDirectory.ts";
import { listRecentBoards } from "../usecase/listRecentBoards.ts";
import { openBoard as openBoardUseCase } from "../usecase/openBoard.ts";
import { saveBoard } from "../usecase/saveBoard.ts";
import { viewMarkdown } from "../usecase/viewMarkdown.ts";
import { saveMarkdown } from "../usecase/saveMarkdown.ts";
import { createMarkdownCard } from "../usecase/createMarkdownCard.ts";
import type { AppDependencies } from "../presentation/context/appContext.ts";
import { createBoardStore } from "../presentation/store/boardStore.ts";
import { createMarkdownViewerStore } from "../presentation/store/markdownViewerStore.ts";

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
  boardStore: createBoardStore(
    async (path) => {
      const board = await openBoardUseCase(path, {
        boardRepository,
        configRepository,
      });
      // Best-effort: the menu rebuild must never block opening the board.
      void refreshRecentMenu();
      return board;
    },
    (path, board) => saveBoard(path, board, { boardRepository }),
    (input) => createMarkdownCard(input, { fileSystem }),
  ),
  directoryBrowsing: {
    listDirectory: (path) => listDirectory(path, { fileSystem }),
    homeDirectory: () => getHomeDirectory({ fileSystem }),
    createDirectory: (parentDirectory, name) =>
      createBoardDirectory(parentDirectory, name, { fileSystem }),
  },
  markdownViewer: createMarkdownViewerStore(
    (path) => viewMarkdown(path, { fileSystem }),
    (path, content) => saveMarkdown(path, content, { fileSystem }),
    () => confirm("Discard unsaved changes to this Markdown file?"),
  ),
  recentBoards: {
    list: () => listRecentBoards({ configRepository }),
  },
};

// Called once at startup (outside React) to set the initial menu and wire
// native "Open Recent" clicks to the board/markdown stores.
export function startApplicationMenu(): void {
  void refreshRecentMenu();
  applicationMenu.onOpenRecent((path) => {
    // Abort the switch if the user declines to discard an unsaved draft.
    if (!appDependencies.markdownViewer.getState().close()) {
      return;
    }
    void appDependencies.boardStore.getState().openBoard(path);
  });
}
