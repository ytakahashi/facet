import type { Label } from "./label.ts";

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
// held by the board, and labels/title override travel with the card itself -
// and swaps only what pointing at another file changes. The title is re-derived
// from the new file, so a card without an explicit title picks up the new
// file's H1 instead of keeping the old file's.
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

// Re-derives the title from the file's current text, for a card whose Markdown
// was just written. Only displayTitle changes: the title is not part of what
// the board file stores unless it is an override, which still wins here.
export function retitleCard(card: Card, markdownText: string): Card {
  return {
    ...card,
    displayTitle: resolveCardTitle(card.titleOverride, markdownText, card.path),
  };
}

// An opening code fence: up to three spaces of indentation, then a run of at
// least three backticks or tildes (CommonMark).
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;

function findFirstH1(markdown: string): string | undefined {
  // Lines inside a fenced code block are code, not headings: a shell comment
  // such as `# install deps` must not become the card's title. A fence closes
  // only on a run of the same character at least as long as the one that
  // opened it, and an unclosed fence runs to the end of the document.
  let fence: string | undefined;
  for (const line of markdown.split("\n")) {
    if (fence !== undefined) {
      const close = FENCE_OPEN.exec(line);
      if (
        close && close[1][0] === fence[0] &&
        close[1].length >= fence.length &&
        line.slice(close[0].length).trim() === ""
      ) {
        fence = undefined;
      }
      continue;
    }
    const open = FENCE_OPEN.exec(line);
    // A backtick fence's info string may not contain a backtick; such a line
    // is inline code, not a fence.
    if (
      open && !(open[1][0] === "`" && line.slice(open[0].length).includes("`"))
    ) {
      fence = open[1];
      continue;
    }
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
