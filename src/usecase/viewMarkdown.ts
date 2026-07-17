import type { FileSystemPort } from "../domain/fileSystemPort.ts";
import { UseCaseError } from "./useCaseError.ts";

export interface ViewMarkdownDeps {
  fileSystem: FileSystemPort;
}

export async function viewMarkdown(
  path: string,
  { fileSystem }: ViewMarkdownDeps,
): Promise<string> {
  try {
    return await fileSystem.readTextFile(path);
  } catch (cause) {
    throw new UseCaseError("markdown.load-failed", { path }, { cause });
  }
}
