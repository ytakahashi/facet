import type { DirEntry } from "../domain/fileSystemPort.ts";

export interface Bindings {
  readTextFile(path: string): Promise<string>;
  readDir(path: string): Promise<DirEntry[]>;
  homeDirectory(): Promise<string>;
}

declare global {
  const bindings: Bindings;
}
