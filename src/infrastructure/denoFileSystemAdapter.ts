import {
  type DirEntry,
  type FileRevision,
  FileSystemError,
  type FileSystemOperation,
  type FileSystemPort,
} from "../domain/fileSystemPort.ts";

async function runFileSystemOperation<T>(
  operation: FileSystemOperation,
  path: string | undefined,
  run: () => Promise<T>,
): Promise<T> {
  try {
    return await run();
  } catch (cause) {
    if (cause instanceof FileSystemError) throw cause;
    throw new FileSystemError("operation-failed", operation, path, { cause });
  }
}

export class DenoFileSystemAdapter implements FileSystemPort {
  async readTextFile(path: string): Promise<string> {
    return (await this.readTextFileWithRevision(path)).content;
  }

  async readTextFileWithRevision(
    path: string,
  ): Promise<{ content: string; revision: FileRevision }> {
    return runFileSystemOperation("read-file", path, async () => {
      const result = await bindings.readTextFile(path);
      if (!result.read) {
        throw new FileSystemError(result.reason, "read-file", path);
      }
      return { content: result.content, revision: result.revision };
    });
  }

  writeTextFile(
    path: string,
    content: string,
    expectedRevision?: FileRevision,
  ): Promise<FileRevision> {
    return runFileSystemOperation(
      "write-file",
      path,
      async () => {
        const result = expectedRevision === undefined
          ? await bindings.writeTextFile(path, content)
          : await bindings.writeTextFile(path, content, expectedRevision);
        if (!result.written) {
          throw new FileSystemError(result.reason, "write-file", path);
        }
        return result.revision;
      },
    );
  }

  async createTextFile(path: string, content: string): Promise<void> {
    return runFileSystemOperation("create-file", path, async () => {
      const result = await bindings.createTextFile(path, content);
      if (!result.created) {
        throw new FileSystemError("already-exists", "create-file", path);
      }
    });
  }

  async removeFile(path: string): Promise<void> {
    return runFileSystemOperation("remove-file", path, async () => {
      const result = await bindings.removeFile(path);
      if (!result.removed) {
        throw new FileSystemError(result.reason, "remove-file", path);
      }
    });
  }

  async renameFile(fromPath: string, toPath: string): Promise<void> {
    return runFileSystemOperation("rename-file", fromPath, async () => {
      const result = await bindings.renameFile(fromPath, toPath);
      if (!result.renamed) {
        // Reported against the path the reason is about: something in the way
        // is about where the file was going, a missing file about where it
        // came from.
        throw new FileSystemError(
          result.reason,
          "rename-file",
          result.reason === "not-found" ? fromPath : toPath,
        );
      }
    });
  }

  readDir(path: string): Promise<DirEntry[]> {
    return runFileSystemOperation(
      "read-directory",
      path,
      () => bindings.readDir(path),
    );
  }

  homeDirectory(): Promise<string> {
    return runFileSystemOperation(
      "get-home-directory",
      undefined,
      () => bindings.homeDirectory(),
    );
  }

  exists(path: string): Promise<boolean> {
    return runFileSystemOperation(
      "check-existence",
      path,
      () => bindings.exists(path),
    );
  }

  mkdir(path: string): Promise<void> {
    return runFileSystemOperation(
      "create-directory",
      path,
      () => bindings.mkdir(path),
    );
  }
}
