import type { Label } from "./label.ts";
import type { Priority } from "./priority.ts";

export type CardFileState =
  | "available"
  | "missing"
  | "unreadable"
  | "unresolvable";

export interface Card {
  path: string;
  absolutePath?: string;
  // What the last read of this card's file found. Not part of board.yaml:
  // whether a file exists is a fact about the file system, and copying it into
  // the board file would create a second source of truth that goes stale the
  // moment the file moves outside the app.
  // "unresolvable" always comes with absolutePath undefined - the path never
  // resolved inside the board directory, so there is nothing to read.
  // "missing" is reserved for a not-found result. "unreadable" means the
  // path resolved but the file could not be read for another reason.
  fileState: CardFileState;
  titleOverride?: string;
  priority?: Priority;
  labels: Label[];
  displayTitle: string;
}

export function isCardFileBroken(card: Card): boolean {
  return card.fileState !== "available";
}

export function resolveCardTitle(
  titleOverride: string | undefined,
  markdownText: string | undefined,
  path: string,
): string {
  if (titleOverride) {
    return titleOverride;
  }

  const heading = markdownText ? findFirstH1(markdownText) : undefined;
  if (heading) {
    return heading;
  }

  return filenameOf(path);
}

export function createCardReference(
  path: string,
  absolutePath: string,
  markdownText: string,
): Card {
  return {
    path,
    absolutePath,
    // The caller has just read (or written) this file, so the card starts out
    // known to be readable.
    fileState: "available",
    labels: [],
    displayTitle: resolveCardTitle(undefined, markdownText, path),
  };
}

// Keeps everything the board knows about this card - its column position is
// held by the board, and priority/labels/title override travel with the card
// itself - and swaps only what pointing at another file changes. The title is
// re-derived from the new file, so a card without an explicit title picks up
// the new file's H1 instead of keeping the old file's.
export function relocateCardReference(
  card: Card,
  path: string,
  absolutePath: string,
  markdownText: string,
): Card {
  return {
    ...card,
    path,
    absolutePath,
    fileState: "available",
    displayTitle: resolveCardTitle(card.titleOverride, markdownText, path),
  };
}

function findFirstH1(markdown: string): string | undefined {
  for (const line of markdown.split("\n")) {
    const match = /^#\s+(.+)$/.exec(line.trim());
    if (match) {
      return match[1].trim();
    }
  }
  return undefined;
}

function filenameOf(path: string): string {
  const base = path.split("/").pop() ?? path;
  return base.replace(/\.md$/, "");
}
