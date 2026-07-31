import {
  type DirEntry,
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
    return runFileSystemOperation("read-file", path, async () => {
      const result = await bindings.readTextFile(path);
      if (!result.read) {
        throw new FileSystemError(result.reason, "read-file", path);
      }
      return result.content;
    });
  }

  writeTextFile(path: string, content: string): Promise<void> {
    return runFileSystemOperation(
      "write-file",
      path,
      () => bindings.writeTextFile(path, content),
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
