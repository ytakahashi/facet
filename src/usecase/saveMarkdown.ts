import {
  type FileRevision,
  FileSystemError,
  type FileSystemPort,
} from "../domain/fileSystemPort.ts";
import { UseCaseError } from "./useCaseError.ts";

export interface SaveMarkdownDeps {
  fileSystem: FileSystemPort;
}

export async function saveMarkdown(
  path: string,
  content: string,
  expectedRevision: FileRevision | undefined,
  { fileSystem }: SaveMarkdownDeps,
): Promise<FileRevision> {
  try {
    return await fileSystem.writeTextFile(path, content, expectedRevision);
  } catch (cause) {
    if (cause instanceof FileSystemError) {
      if (cause.kind === "revision-mismatch") {
        throw new UseCaseError("markdown.conflict", { path }, { cause });
      }
      if (cause.kind === "not-found") {
        throw new UseCaseError("markdown.file-gone", { path }, { cause });
      }
    }
    throw new UseCaseError("markdown.save-failed", { path }, { cause });
  }
}
