export type ResolvedCardPath =
  | { ok: true; absolutePath: string }
  | { ok: false; reason: "absolute-path" | "escapes-board-directory" };

export function hasTrailingPathSeparator(path: string): boolean {
  return path.trim().endsWith("/");
}

/**
 * Resolves a card's YAML-relative path against the board file's own directory,
 * rejecting anything that would land outside it.
 * This is a product invariant, not a security boundary.
 */
export function resolveCardPath(
  boardDirectory: string,
  cardPath: string,
): ResolvedCardPath {
  if (cardPath.startsWith("/")) {
    return { ok: false, reason: "absolute-path" };
  }

  const segments: string[] = [];
  for (const segment of cardPath.split("/")) {
    if (segment === "" || segment === ".") {
      continue;
    }
    if (segment === "..") {
      if (segments.length === 0) {
        return { ok: false, reason: "escapes-board-directory" };
      }
      segments.pop();
      continue;
    }
    segments.push(segment);
  }

  const normalizedBoardDirectory = boardDirectory.endsWith("/")
    ? boardDirectory.slice(0, -1)
    : boardDirectory;

  return {
    ok: true,
    absolutePath: [normalizedBoardDirectory, ...segments].join("/"),
  };
}

export function directoryOf(path: string): string {
  const index = path.lastIndexOf("/");
  return index === -1 ? "" : path.slice(0, index);
}

// The counterpart to directoryOf: everything after the last separator. The
// extension is kept - this names the file, it does not describe it, so it is
// not the same thing as the filename a card falls back to for its title.
export function fileNameOf(path: string): string {
  const index = path.lastIndexOf("/");
  return index === -1 ? path : path.slice(index + 1);
}

export type RelativeCardPathResult =
  | { ok: true; path: string }
  | { ok: false; reason: "outside-board-directory" | "not-a-file" };

export function toRelativeCardPath(
  boardDirectory: string,
  absolutePath: string,
): RelativeCardPathResult {
  const boardSegments = normalizeAbsolutePath(boardDirectory);
  const fileSegments = normalizeAbsolutePath(absolutePath);

  if (!boardSegments || !fileSegments) {
    return { ok: false, reason: "outside-board-directory" };
  }
  if (fileSegments.length <= boardSegments.length) {
    return {
      ok: false,
      reason: fileSegments.length === boardSegments.length &&
          fileSegments.every((segment, index) =>
            segment === boardSegments[index]
          )
        ? "not-a-file"
        : "outside-board-directory",
    };
  }
  if (
    !boardSegments.every((segment, index) => segment === fileSegments[index])
  ) {
    return { ok: false, reason: "outside-board-directory" };
  }

  return { ok: true, path: fileSegments.slice(boardSegments.length).join("/") };
}

export function normalizeCardPath(path: string): string {
  const segments: string[] = [];
  for (const segment of path.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === ".." && segments.at(-1) !== "..") {
      if (segments.length > 0) {
        segments.pop();
      } else {
        segments.push(segment);
      }
      continue;
    }
    segments.push(segment);
  }
  return segments.join("/");
}

function normalizeAbsolutePath(path: string): string[] | undefined {
  if (!path.startsWith("/")) return undefined;

  const segments: string[] = [];
  for (const segment of path.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      segments.pop();
    } else {
      segments.push(segment);
    }
  }
  return segments;
}
