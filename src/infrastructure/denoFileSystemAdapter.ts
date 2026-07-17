import {
  type DirEntry,
  FileAlreadyExistsError,
  type FileSystemPort,
} from "../domain/fileSystemPort.ts";

export class DenoFileSystemAdapter implements FileSystemPort {
  readTextFile(path: string): Promise<string> {
    return bindings.readTextFile(path);
  }

  writeTextFile(path: string, content: string): Promise<void> {
    return bindings.writeTextFile(path, content);
  }

  async createTextFile(path: string, content: string): Promise<void> {
    const result = await bindings.createTextFile(path, content);
    if (!result.created) {
      throw new FileAlreadyExistsError(path);
    }
  }

  readDir(path: string): Promise<DirEntry[]> {
    return bindings.readDir(path);
  }

  homeDirectory(): Promise<string> {
    return bindings.homeDirectory();
  }

  exists(path: string): Promise<boolean> {
    return bindings.exists(path);
  }

  mkdir(path: string): Promise<void> {
    return bindings.mkdir(path);
  }
}
