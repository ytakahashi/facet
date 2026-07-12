import type { DirEntry, FileSystemPort } from "../domain/fileSystemPort.ts";

export interface BrowseDirectoryDeps {
  fileSystem: FileSystemPort;
}

export function listDirectory(
  path: string,
  { fileSystem }: BrowseDirectoryDeps,
): Promise<DirEntry[]> {
  return fileSystem.readDir(path);
}

export function getHomeDirectory(
  { fileSystem }: BrowseDirectoryDeps,
): Promise<string> {
  return fileSystem.homeDirectory();
}
