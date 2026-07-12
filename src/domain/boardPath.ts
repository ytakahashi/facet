export type ResolvedCardPath =
  | { ok: true; absolutePath: string }
  | { ok: false; reason: "absolute-path" | "escapes-board-directory" };

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
