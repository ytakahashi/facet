export interface DirEntry {
  name: string;
  isDirectory: boolean;
}

export interface FileSystemPort {
  readTextFile(path: string): Promise<string>;
  readDir(path: string): Promise<DirEntry[]>;
  homeDirectory(): Promise<string>;
}
