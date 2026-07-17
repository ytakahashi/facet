import type { DirEntry, FileSystemPort } from "../domain/fileSystemPort.ts";
import { UseCaseError } from "./useCaseError.ts";

export interface BrowseDirectoryDeps {
  fileSystem: FileSystemPort;
}

export async function listDirectory(
  path: string,
  { fileSystem }: BrowseDirectoryDeps,
): Promise<DirEntry[]> {
  try {
    return await fileSystem.readDir(path);
  } catch (cause) {
    throw new UseCaseError("directory.browse-failed", { path }, { cause });
  }
}

export async function getHomeDirectory(
  { fileSystem }: BrowseDirectoryDeps,
): Promise<string> {
  try {
    return await fileSystem.homeDirectory();
  } catch (cause) {
    throw new UseCaseError("directory.home-failed", {}, { cause });
  }
}
