import type { DirEntry, FileSystemPort } from "../domain/fileSystemPort.ts";

export class DenoFileSystemAdapter implements FileSystemPort {
  readTextFile(path: string): Promise<string> {
    return bindings.readTextFile(path);
  }

  readDir(path: string): Promise<DirEntry[]> {
    return bindings.readDir(path);
  }

  homeDirectory(): Promise<string> {
    return bindings.homeDirectory();
  }
}
