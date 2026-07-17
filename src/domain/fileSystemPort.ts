export interface DirEntry {
  name: string;
  isDirectory: boolean;
}

export type FileSystemErrorKind = "already-exists" | "operation-failed";
export type FileSystemOperation =
  | "read-file"
  | "write-file"
  | "create-file"
  | "read-directory"
  | "create-directory"
  | "get-home-directory"
  | "check-existence";

export class FileSystemError extends Error {
  readonly kind: FileSystemErrorKind;
  readonly operation: FileSystemOperation;
  readonly path?: string;

  constructor(
    kind: FileSystemErrorKind,
    operation: FileSystemOperation,
    path?: string,
    options?: ErrorOptions,
  ) {
    super(`${operation}:${kind}`, options);
    this.name = "FileSystemError";
    this.kind = kind;
    this.operation = operation;
    this.path = path;
  }
}

export interface FileSystemPort {
  readTextFile(path: string): Promise<string>;
  writeTextFile(path: string, content: string): Promise<void>;
  createTextFile(path: string, content: string): Promise<void>;
  readDir(path: string): Promise<DirEntry[]>;
  homeDirectory(): Promise<string>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
}
