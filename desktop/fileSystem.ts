// The file-system half of what the webview may ask the host to do.
//
// Kept out of main.ts so it can be exercised against a real file system, the
// same reason renameFile.ts sits on its own: what these functions are careful
// about - an empty directory that removes like a file, a write that lands
// short, the two things NotFound can mean - are facts about the file system
// rather than about this application, and a stubbed test would only restate
// the assumptions being questioned.
//
// Nothing here may reference Deno Desktop's types: `deno test` cannot see
// them, and these are the modules the tests reach.

// Mirror the result types on the webview side. Deno.errors instances do not
// survive the binding boundary, so every failure a caller has to tell apart is
// reported as data. Declared here rather than imported from src/ because the
// two processes are compiled as separate programs.
export type FileRevision = string;

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

export interface DirEntry {
  name: string;
  isDirectory: boolean;
}

async function revisionOf(
  bytes: Uint8Array<ArrayBuffer>,
): Promise<FileRevision> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

// A missing file is classified here and reported as data, the same way
// createTextFile reports already-exists. Callers that repair a card's path
// need "nothing is there" told apart from "there but unreadable".
export async function readTextFile(path: string): Promise<ReadTextFileResult> {
  try {
    const bytes = await Deno.readFile(path);
    return {
      read: true,
      content: new TextDecoder().decode(bytes),
      revision: await revisionOf(bytes),
    };
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return { read: false, reason: "not-found" };
    }
    throw error;
  }
}

export async function writeTextFile(
  path: string,
  content: string,
  expectedRevision?: FileRevision | null,
): Promise<WriteTextFileResult> {
  // An explicitly undefined optional argument can cross the binding boundary
  // as null. Only a string opts into conditional writing; other values retain
  // the unconditional behavior promised to callers that omit the revision.
  if (typeof expectedRevision === "string") {
    let currentBytes: Uint8Array<ArrayBuffer>;
    try {
      currentBytes = await Deno.readFile(path);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return { written: false, reason: "not-found" };
      }
      throw error;
    }

    if (await revisionOf(currentBytes) !== expectedRevision) {
      return { written: false, reason: "revision-mismatch" };
    }
  }

  // Deno exposes no atomic compare-and-write primitive. Keeping the check and
  // write in this host call minimizes, but cannot eliminate, the race between
  // observing the current revision and replacing the file.
  const bytes = new TextEncoder().encode(content);
  await Deno.writeFile(path, bytes);
  return { written: true, revision: await revisionOf(bytes) };
}

// Exclusive through createNew rather than an exists() check followed by a
// write: creating a card's Markdown must never land on a file that is already
// there, and only the open(2) flag decides that without leaving a gap for one
// to appear in. An existing file is reported as data, the way removeFile
// reports a missing one.
// The write loops because a single write() may be partial, which would
// otherwise leave a truncated file behind a "created" result.
export async function createTextFile(
  path: string,
  content: string,
): Promise<CreateTextFileResult> {
  try {
    const file = await Deno.open(path, { write: true, createNew: true });
    try {
      const bytes = new TextEncoder().encode(content);
      let offset = 0;
      while (offset < bytes.length) {
        const written = await file.write(bytes.subarray(offset));
        if (written === 0) {
          throw new Error(`Failed to write the complete file: ${path}`);
        }
        offset += written;
      }
    } finally {
      file.close();
    }
    return { created: true };
  } catch (error) {
    if (error instanceof Deno.errors.AlreadyExists) {
      return { created: false, reason: "already-exists" };
    }
    throw error;
  }
}

// Deno.remove without `recursive` still removes an *empty* directory, and a
// board.yaml can name one (a hand-written path, or a directory literally named
// "foo.md"), so directories are rejected explicitly rather than left to the
// missing `recursive` flag. lstat, not stat, so the check describes the path
// itself; a symlink to a Markdown file stays removable.
export async function removeFile(path: string): Promise<RemoveFileResult> {
  try {
    const info = await Deno.lstat(path);
    if (info.isDirectory) {
      return { removed: false, reason: "is-a-directory" };
    }
    await Deno.remove(path);
    return { removed: true };
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return { removed: false, reason: "not-found" };
    }
    throw error;
  }
}

// Copied field by field rather than passed through: Deno.DirEntry also carries
// isFile and isSymlink, and the boundary should only ever hand over what the
// view actually asked about.
export async function readDir(path: string): Promise<DirEntry[]> {
  const entries: DirEntry[] = [];
  for await (const entry of Deno.readDir(path)) {
    entries.push({ name: entry.name, isDirectory: entry.isDirectory });
  }
  return entries;
}

export async function homeDirectory(): Promise<string> {
  return Deno.env.get("HOME") ?? "/";
}

// Answers about the path resolved, not about the entry: a symlink counts as
// existing when its target does. Any failure at all means "no", because the
// only caller uses this to decide whether a card's file is still there and a
// path it cannot even stat is no better than a missing one.
export async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function mkdir(path: string): Promise<void> {
  await Deno.mkdir(path, { recursive: true });
}
