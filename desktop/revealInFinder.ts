// This host capability checks the file system and starts Finder in one binding
// call. A file may still disappear between stat and open; that is a failed
// reveal, not a reason to change the board's state.
export type RevealInFinderResult =
  | { revealed: true }
  | { revealed: false; reason: "not-found" | "failed" };

type OpenRunner = (args: string[]) => Promise<boolean>;

async function runOpen(args: string[]): Promise<boolean> {
  const result = await new Deno.Command("open", {
    args,
    stdout: "null",
    stderr: "null",
  }).output();
  return result.success;
}

async function statIfPresent(path: string): Promise<Deno.FileInfo | undefined> {
  try {
    return await Deno.stat(path);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return undefined;
    throw error;
  }
}

function parentDirectory(path: string): string | undefined {
  const slash = path.lastIndexOf("/");
  if (slash < 0) return undefined;
  return slash === 0 ? "/" : path.slice(0, slash);
}

export async function revealInFinder(
  path: string,
  open: OpenRunner = runOpen,
): Promise<RevealInFinderResult> {
  try {
    if (await statIfPresent(path)) {
      return await open(["-R", path])
        ? { revealed: true }
        : { revealed: false, reason: "failed" };
    }

    const directory = parentDirectory(path);
    if (!directory || !(await statIfPresent(directory))?.isDirectory) {
      return { revealed: false, reason: "not-found" };
    }
    return await open([directory])
      ? { revealed: true }
      : { revealed: false, reason: "failed" };
  } catch {
    return { revealed: false, reason: "failed" };
  }
}
