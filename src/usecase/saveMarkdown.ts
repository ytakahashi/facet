import type { FileSystemPort } from "../domain/fileSystemPort.ts";

export interface SaveMarkdownDeps {
  fileSystem: FileSystemPort;
}

export function saveMarkdown(
  path: string,
  content: string,
  { fileSystem }: SaveMarkdownDeps,
): Promise<void> {
  return fileSystem.writeTextFile(path, content);
}
