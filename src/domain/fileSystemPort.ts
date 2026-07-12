export interface FileSystemPort {
  readTextFile(path: string): Promise<string>;
}
