import { DenoFileSystemAdapter } from "../infrastructure/denoFileSystemAdapter.ts";
import { YamlBoardRepository } from "../infrastructure/yamlBoardRepository.ts";
import { getHomeDirectory, listDirectory } from "../usecase/browseDirectory.ts";
import { openBoard as openBoardUseCase } from "../usecase/openBoard.ts";
import { saveBoard } from "../usecase/saveBoard.ts";
import { viewMarkdown } from "../usecase/viewMarkdown.ts";
import { saveMarkdown } from "../usecase/saveMarkdown.ts";
import type { AppDependencies } from "../presentation/context/appContext.ts";
import { createBoardStore } from "../presentation/store/boardStore.ts";
import { createMarkdownViewerStore } from "../presentation/store/markdownViewerStore.ts";

const fileSystem = new DenoFileSystemAdapter();
const boardRepository = new YamlBoardRepository(fileSystem);

export const appDependencies: AppDependencies = {
  boardStore: createBoardStore(
    (path) => openBoardUseCase(path, { boardRepository }),
    (path, board) => saveBoard(path, board, { boardRepository }),
  ),
  directoryBrowsing: {
    listDirectory: (path) => listDirectory(path, { fileSystem }),
    homeDirectory: () => getHomeDirectory({ fileSystem }),
  },
  markdownViewer: createMarkdownViewerStore(
    (path) => viewMarkdown(path, { fileSystem }),
    (path, content) => saveMarkdown(path, content, { fileSystem }),
    () => confirm("Discard unsaved changes to this Markdown file?"),
  ),
};
