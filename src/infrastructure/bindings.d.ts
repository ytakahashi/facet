import type { DirEntry } from "../domain/fileSystemPort.ts";
import type { MenuItem } from "./denoApplicationMenu.ts";

export interface Bindings {
  readTextFile(path: string): Promise<string>;
  writeTextFile(path: string, content: string): Promise<void>;
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
