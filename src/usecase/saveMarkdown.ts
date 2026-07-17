import type { FileSystemPort } from "../domain/fileSystemPort.ts";
import { UseCaseError } from "./useCaseError.ts";

export interface SaveMarkdownDeps {
  fileSystem: FileSystemPort;
}

export async function saveMarkdown(
  path: string,
  content: string,
  { fileSystem }: SaveMarkdownDeps,
): Promise<void> {
  try {
    await fileSystem.writeTextFile(path, content);
  } catch (cause) {
    throw new UseCaseError("markdown.save-failed", { path }, { cause });
  }
}
