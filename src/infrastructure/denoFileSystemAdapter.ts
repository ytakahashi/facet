import type { DirEntry, FileSystemPort } from "../domain/fileSystemPort.ts";

export class DenoFileSystemAdapter implements FileSystemPort {
  readTextFile(path: string): Promise<string> {
    return bindings.readTextFile(path);
  }

  writeTextFile(path: string, content: string): Promise<void> {
    return bindings.writeTextFile(path, content);
  }

  readDir(path: string): Promise<DirEntry[]> {
    return bindings.readDir(path);
  }

  homeDirectory(): Promise<string> {
    return bindings.homeDirectory();
  }
}
