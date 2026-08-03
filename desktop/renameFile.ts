// Mirrors RenameFileResult on the webview side: Deno.errors instances do not
// survive the binding boundary, so every reason a move did not happen is
// reported as data.
export type RenameFileResult =
  | { renamed: true }
  | {
    renamed: false;
    reason: "not-found" | "already-exists" | "is-a-directory";
  };

async function pathExists(path: string): Promise<boolean> {
  try {
    await Deno.lstat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
}

// Two paths can share an inode for two very different reasons: they are one
// directory entry spelled two ways (the case-only rename the inode check
// exists to allow), or they are separate hard links to the same file.
// Renaming a hard link onto its sibling succeeds while doing nothing, which
// would leave the file at both paths while the board followed it to one.
// The link count settles it on its own: a file with a single link cannot have
// a sibling anywhere. realPath is consulted only when it might, so a case-only
// rename never depends on how realPath chooses to spell its answer - and when
// it cannot answer at all, the paths are called different, which costs a
// rename rather than a file.
async function namesTheSameEntry(
  from: string,
  to: string,
  source: Deno.FileInfo,
): Promise<boolean> {
  if (source.nlink === 1) return true;
  // realPath resolves a trailing symlink, so for a symlink it answers about
  // the target instead of about the entry, and two hard links to one symlink
  // both answer with that target. Nothing here can tell them apart, so they
  // are called different - the same safe direction taken when realPath cannot
  // answer at all.
  if (source.isSymlink) return false;
  try {
    const [sourcePath, destinationPath] = await Promise.all([
      Deno.realPath(from),
      Deno.realPath(to),
    ]);
    return sourcePath === destinationPath;
  } catch {
    return false;
  }
}

// Deno.rename replaces an existing destination without a word, so the check
// that nothing is about to be overwritten happens here, next to the call it
// guards: the two system calls stay inside one binding invocation, which is as
// narrow as the gap between them can be made without an atomic primitive Deno
// does not expose.
// The destination is compared by inode rather than by path: on the
// case-insensitive volumes macOS formats by default, renaming Task.md to
// task.md names the very same file, and that is a rename, not a collision.
// A file system that cannot answer with an inode gets the safe answer -
// occupied - because guessing wrong the other way destroys a file.
// lstat, not stat, so a dangling symlink at the destination still counts as
// occupied; Deno.rename would replace it.
// The source needs no directory check of its own: the caller has just read it
// as text, which a directory cannot be.
export async function renameFile(
  sourcePath: string,
  destinationPath: string,
): Promise<RenameFileResult> {
  try {
    const [source, destination] = await Promise.all([
      Deno.lstat(sourcePath),
      Deno.lstat(destinationPath),
    ]);
    const isSameInode = source.ino !== null && source.dev !== null &&
      source.ino === destination.ino && source.dev === destination.dev;
    if (
      !isSameInode ||
      !await namesTheSameEntry(sourcePath, destinationPath, source)
    ) {
      return {
        renamed: false,
        // Told apart so the message can name what is actually in the way: a
        // directory is not a file the user can go and look at.
        reason: destination.isDirectory ? "is-a-directory" : "already-exists",
      };
    }
  } catch (error) {
    // A missing source falls through to Deno.rename, which reports it below;
    // a missing destination is the ordinary case and means nothing is in the
    // way.
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }

  try {
    await Deno.rename(sourcePath, destinationPath);
    return { renamed: true };
  } catch (error) {
    // NotFound also stands for a destination directory that is not there, so
    // the source is asked about before its absence is reported. Blaming the
    // source for the destination's problem would send the user off to repair a
    // card whose file never moved.
    if (
      error instanceof Deno.errors.NotFound && !await pathExists(sourcePath)
    ) {
      return { renamed: false, reason: "not-found" };
    }
    throw error;
  }
}
