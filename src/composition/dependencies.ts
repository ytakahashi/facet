import { DenoFileSystemAdapter } from "../infrastructure/denoFileSystemAdapter.ts";
import { YamlBoardRepository } from "../infrastructure/yamlBoardRepository.ts";
import { getHomeDirectory, listDirectory } from "../usecase/browseDirectory.ts";
import { openBoard as openBoardUseCase } from "../usecase/openBoard.ts";
import type { AppDependencies } from "../presentation/context/appContext.ts";
import { createBoardStore } from "../presentation/store/boardStore.ts";

const fileSystem = new DenoFileSystemAdapter();
const boardRepository = new YamlBoardRepository(fileSystem);

export const appDependencies: AppDependencies = {
  boardStore: createBoardStore((path) =>
    openBoardUseCase(path, { boardRepository })
  ),
  directoryBrowsing: {
    listDirectory: (path) => listDirectory(path, { fileSystem }),
    homeDirectory: () => getHomeDirectory({ fileSystem }),
  },
};
