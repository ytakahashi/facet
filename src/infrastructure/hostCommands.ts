// The view's half of the host boundary: one typed function per Tauri command
// in src-tauri/src/commands.rs. The only module that calls invoke().
//
// The result types mirror the serde shapes on the Rust side. The two sides are
// compiled as separate programs, so they are kept in step by hand; the Rust
// tests pin each shape as JSON. Argument names are camelCase here and arrive
// as the snake_case parameters of the Rust command.
import { invoke } from "@tauri-apps/api/core";
import type { DirEntry, FileRevision } from "../domain/fileSystemPort.ts";

export type ReadTextFileResult =
  | { read: true; content: string; revision: FileRevision }
  | { read: false; reason: "not-found" };

export type WriteTextFileResult =
  | { written: true; revision: FileRevision }
  | { written: false; reason: "revision-mismatch" | "not-found" };

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

export type RevealInFinderResult =
  | { revealed: true }
  | { revealed: false; reason: "not-found" | "failed" };

export function readTextFile(path: string): Promise<ReadTextFileResult> {
  return invoke("read_text_file", { path });
}

// An omitted revision is sent as null, which the command reads as "write
// unconditionally" - the same as leaving it out.
export function writeTextFile(
  path: string,
  content: string,
  expectedRevision?: FileRevision,
): Promise<WriteTextFileResult> {
  return invoke("write_text_file", {
    path,
    content,
    expectedRevision: expectedRevision ?? null,
  });
}

export function createTextFile(
  path: string,
  content: string,
): Promise<CreateTextFileResult> {
  return invoke("create_text_file", { path, content });
}

export function removeFile(path: string): Promise<RemoveFileResult> {
  return invoke("remove_file", { path });
}

export function renameFile(
  fromPath: string,
  toPath: string,
): Promise<RenameFileResult> {
  return invoke("rename_file", { fromPath, toPath });
}

export function readDir(path: string): Promise<DirEntry[]> {
  return invoke("read_dir", { path });
}

export function homeDirectory(): Promise<string> {
  return invoke("home_directory");
}

export function exists(path: string): Promise<boolean> {
  return invoke("exists", { path });
}

export function mkdir(path: string): Promise<void> {
  return invoke("mkdir", { path });
}

export function revealInFinder(path: string): Promise<RevealInFinderResult> {
  return invoke("reveal_in_finder", { path });
}
