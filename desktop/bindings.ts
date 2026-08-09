import type {
  CreateTextFileResult,
  DirEntry,
  ReadTextFileResult,
  RemoveFileResult,
} from "./fileSystem.ts";
import type { RenameFileResult } from "./renameFile.ts";

// The host's half of the boundary, and the mirror of
// src/infrastructure/bindings.d.ts. Declared twice on purpose: the two sides
// are compiled as separate programs, and only raw strings and plain data ever
// cross between them.
//
// Handing this to Deno.BrowserWindow is what gives each win.bind() handler its
// own parameter types; left to its default, they widen to `any`.
export interface HostBindings {
  readTextFile(path: string): Promise<ReadTextFileResult>;
  writeTextFile(path: string, content: string): Promise<void>;
  createTextFile(path: string, content: string): Promise<CreateTextFileResult>;
  removeFile(path: string): Promise<RemoveFileResult>;
  renameFile(fromPath: string, toPath: string): Promise<RenameFileResult>;
  readDir(path: string): Promise<DirEntry[]>;
  homeDirectory(): Promise<string>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
  setApplicationMenu(menu: Deno.MenuItem[]): Promise<void>;
  nextMenuClick(): Promise<string>;
}

// Registering in one pass, from a value typed as HostBindings, is what makes a
// binding declared above but never given a handler fail to compile. bind()
// cannot catch that on its own: it checks each name it is handed, and a name
// it is never handed stays invisible to it.
export function bindAll(
  win: Deno.BrowserWindow<HostBindings>,
  handlers: HostBindings,
): void {
  // Object.keys widens its result to string[]; the cast restores what the
  // argument's own type already guarantees about what those keys are.
  for (const name of Object.keys(handlers) as (keyof HostBindings)[]) {
    win.bind(name, handlers[name]);
  }
}
