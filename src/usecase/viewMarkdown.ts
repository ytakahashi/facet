import type { FileSystemPort } from "../domain/fileSystemPort.ts";

export interface ViewMarkdownDeps {
  fileSystem: FileSystemPort;
}

export function viewMarkdown(
  path: string,
  { fileSystem }: ViewMarkdownDeps,
): Promise<string> {
  return fileSystem.readTextFile(path);
}
