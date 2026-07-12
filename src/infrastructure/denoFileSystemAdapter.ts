import type { FileSystemPort } from "../domain/fileSystemPort.ts";

export class DenoFileSystemAdapter implements FileSystemPort {
  readTextFile(path: string): Promise<string> {
    return bindings.readTextFile(path);
  }
}
