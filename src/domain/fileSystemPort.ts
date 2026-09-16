export interface DirEntry {
  name: string;
  isDirectory: boolean;
}

export type FileRevision = string;

export type FileSystemErrorKind =
  | "already-exists"
  | "not-found"
  | "revision-mismatch"
  | "is-a-directory"
  | "operation-failed";
export type FileSystemOperation =
  | "read-file"
  | "write-file"
  | "create-file"
  | "remove-file"
  | "read-directory"
  | "create-directory"
  | "get-home-directory"
  | "check-existence"
  | "rename-file";

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
  readTextFileWithRevision(
    path: string,
  ): Promise<{ content: string; revision: FileRevision }>;
  writeTextFile(
    path: string,
    content: string,
    expectedRevision?: FileRevision,
  ): Promise<FileRevision>;
  createTextFile(path: string, content: string): Promise<void>;
  // Removes a single file. Refuses a directory with an "is-a-directory"
  // error: an empty directory is removable at the OS level, and a card path
  // is only ever meant to name a file.
  // Reports a missing file as a "not-found" FileSystemError rather than
  // succeeding: the port stays faithful to what actually happened, and each
  // caller decides whether "the file is already gone" meets its goal.
  removeFile(path: string): Promise<void>;
  // Moves a file to another path. Renaming and moving are one operation: the
  // destination is a whole path, not a name. Refuses to overwrite whatever is
  // already at the destination - "is-a-directory" for a directory,
  // "already-exists" for anything else - because the move underneath would
  // replace it silently, and a card's Markdown must never be destroyed by one.
  // A destination that turns out to be the source itself is not a collision,
  // so a change of letter case is a rename like any other.
  renameFile(fromPath: string, toPath: string): Promise<void>;
  readDir(path: string): Promise<DirEntry[]>;
  homeDirectory(): Promise<string>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
}
