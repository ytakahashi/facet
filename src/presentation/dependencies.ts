import { DenoFileSystemAdapter } from "../infrastructure/denoFileSystemAdapter.ts";
import { YamlBoardRepository } from "../infrastructure/yamlBoardRepository.ts";
import { getHomeDirectory, listDirectory } from "../usecase/browseDirectory.ts";
import { openBoard as openBoardUseCase } from "../usecase/openBoard.ts";
import type { DirectoryBrowsing } from "./directoryBrowsingContext.ts";
import { createBoardStore } from "./store/boardStore.ts";

const fileSystem = new DenoFileSystemAdapter();
const boardRepository = new YamlBoardRepository(fileSystem);

export const boardStore = createBoardStore((path) =>
  openBoardUseCase(path, { boardRepository })
);

export const directoryBrowsing: DirectoryBrowsing = {
  listDirectory: (path) => listDirectory(path, { fileSystem }),
  homeDirectory: () => getHomeDirectory({ fileSystem }),
};
