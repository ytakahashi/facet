import { FileSystemError } from "../domain/fileSystemPort.ts";
import type { FileSystemPort } from "../domain/fileSystemPort.ts";
import { UseCaseError } from "./useCaseError.ts";

export interface DeleteMarkdownDeps {
  fileSystem: FileSystemPort;
}

// A file that is already gone satisfies the caller's goal - the file is not
// there - so a missing file is not an error here. Failing instead would leave
// a card whose Markdown was removed outside the app impossible to delete from
// the board. Every other reason the port reports, including a path that turned
// out to be a directory, stays an error: only absence means "done".
// Deletion is permanent: there is no Trash API to fall back on, so the caller
// is responsible for confirming with the user first.
export async function deleteMarkdown(
  path: string,
  { fileSystem }: DeleteMarkdownDeps,
): Promise<void> {
  try {
    await fileSystem.removeFile(path);
  } catch (cause) {
    if (cause instanceof FileSystemError && cause.kind === "not-found") {
      return;
    }
    throw new UseCaseError("markdown.delete-failed", { path }, { cause });
  }
}
