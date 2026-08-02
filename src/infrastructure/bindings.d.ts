import type { DirEntry } from "../domain/fileSystemPort.ts";
import type { MenuItem } from "./denoApplicationMenu.ts";

export type ReadTextFileResult =
  | { read: true; content: string }
  | { read: false; reason: "not-found" };

export type CreateTextFileResult =
  | { created: true }
  | { created: false; reason: "already-exists" };

export type RemoveFileResult =
  | { removed: true }
  | { removed: false; reason: "not-found" | "is-a-directory" };

export type RenameFileResult =
  | { renamed: true }
  | {
    renamed: false;
    reason: "not-found" | "already-exists" | "is-a-directory";
  };

export interface Bindings {
  readTextFile(path: string): Promise<ReadTextFileResult>;
  writeTextFile(path: string, content: string): Promise<void>;
  createTextFile(path: string, content: string): Promise<CreateTextFileResult>;
  removeFile(path: string): Promise<RemoveFileResult>;
  renameFile(fromPath: string, toPath: string): Promise<RenameFileResult>;
  readDir(path: string): Promise<DirEntry[]>;
  homeDirectory(): Promise<string>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
  setApplicationMenu(menu: MenuItem[]): Promise<void>;
  nextMenuClick(): Promise<string>;
}

declare global {
  const bindings: Bindings;
}
