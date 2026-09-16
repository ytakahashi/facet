import type { FileRevision, FileSystemPort } from "../domain/fileSystemPort.ts";
import { UseCaseError } from "./useCaseError.ts";

export interface ViewMarkdownDeps {
  fileSystem: FileSystemPort;
}

export async function viewMarkdown(
  path: string,
  { fileSystem }: ViewMarkdownDeps,
): Promise<{ content: string; revision: FileRevision }> {
  try {
    return await fileSystem.readTextFileWithRevision(path);
  } catch (cause) {
    throw new UseCaseError("markdown.load-failed", { path }, { cause });
  }
}
