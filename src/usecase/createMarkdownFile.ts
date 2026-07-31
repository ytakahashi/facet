import {
  FileSystemError,
  type FileSystemPort,
} from "../domain/fileSystemPort.ts";
import { UseCaseError } from "./useCaseError.ts";

export interface CreateMarkdownFileDeps {
  fileSystem: FileSystemPort;
}

// Writes a Markdown file that must not already exist, shared by every flow
// that puts a new file behind a card. The existence check is a courtesy that
// reports the collision before anything is written; createTextFile's
// create-new semantics are what actually guarantee an existing file is never
// overwritten, including when the file appears between the two calls.
export async function createMarkdownFile(
  absolutePath: string,
  markdown: string,
  { fileSystem }: CreateMarkdownFileDeps,
): Promise<void> {
  let exists: boolean;
  try {
    exists = await fileSystem.exists(absolutePath);
  } catch (cause) {
    throw new UseCaseError(
      "card.create-failed",
      { path: absolutePath },
      { cause },
    );
  }
  if (exists) {
    throw new UseCaseError("card.file-already-exists", { path: absolutePath });
  }

  try {
    await fileSystem.createTextFile(absolutePath, markdown);
  } catch (cause) {
    if (cause instanceof FileSystemError && cause.kind === "already-exists") {
      throw new UseCaseError(
        "card.file-already-exists",
        { path: absolutePath },
        { cause },
      );
    }
    throw new UseCaseError(
      "card.create-failed",
      { path: absolutePath },
      { cause },
    );
  }
}
