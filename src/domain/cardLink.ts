import type { Board } from "./board.ts";
import { findCardByEquivalentPath } from "./board.ts";
import { directoryOf, isSameCardPath, normalizeCardPath } from "./boardPath.ts";
import type { Card } from "./card.ts";

const URI_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

// Resolves only links that lead to another card on the same board. Everything
// else stays inert in the preview, including external URLs and Markdown files
// the board does not hold a card for.
export function resolveCardLink(
  board: Board,
  fromPath: string,
  href: string,
): Card | undefined {
  if (
    href === "" ||
    href.startsWith("#") ||
    href.startsWith("/") ||
    URI_SCHEME.test(href)
  ) {
    return undefined;
  }

  // Strip delimiters before decoding: an encoded question mark or hash is
  // part of the filename, not the beginning of a query or fragment.
  const delimiterIndex = href.search(/[?#]/);
  const encodedPath = delimiterIndex === -1
    ? href
    : href.slice(0, delimiterIndex);
  if (encodedPath === "") return undefined;

  let decodedPath: string;
  try {
    // Card paths use slashes as separators, and macOS filenames cannot contain
    // a literal slash, so an encoded slash intentionally becomes a separator.
    decodedPath = decodeURIComponent(encodedPath);
  } catch {
    return undefined;
  }

  // Decoding can reveal a leading slash that was not visible in the href.
  if (
    decodedPath.startsWith("/") || !decodedPath.toLowerCase().endsWith(".md")
  ) {
    return undefined;
  }

  const targetPath = normalizeCardPath(
    [directoryOf(fromPath), decodedPath].filter(Boolean).join("/"),
  );
  if (targetPath.startsWith("../")) {
    return undefined;
  }

  return findCardByEquivalentPath(board, targetPath);
}

// Builds the inverse of resolveCardLink: the generated href is relative to
// the source card's directory and keeps the destination card's own spelling.
export function cardLinkHref(fromPath: string, toPath: string): string {
  const normalizedFrom = normalizeLinkCardPath(fromPath);
  const normalizedTo = normalizeLinkCardPath(toPath);
  const fromDirectory = splitPath(directoryOf(normalizedFrom));
  const toSegments = splitPath(normalizedTo);
  const toDirectory = toSegments.slice(0, -1);

  let commonLength = 0;
  while (
    commonLength < fromDirectory.length &&
    commonLength < toDirectory.length &&
    isSameCardPath(
      fromDirectory[commonLength],
      toDirectory[commonLength],
    )
  ) {
    commonLength += 1;
  }

  const parentSegments = fromDirectory.slice(commonLength).map(() => "..");
  const destinationSegments = toSegments.slice(commonLength).map(
    encodeLinkPathSegment,
  );
  const relativePath = [...parentSegments, ...destinationSegments].join("/");
  return parentSegments.length === 0 ? `./${relativePath}` : relativePath;
}

export function cardLinkMarkdown(
  fromPath: string,
  card: Card,
  linkText = card.displayTitle,
): string {
  return `[${escapeLinkText(linkText)}](${cardLinkHref(fromPath, card.path)})`;
}

// A generated link can only round-trip through resolveCardLink when its card
// path stays below the board directory and names a Markdown file. Board files
// can be hand-written, so Card.fileState alone cannot guarantee either rule.
export function isLinkableCardPath(path: string): boolean {
  const normalized = normalizeCardPath(path);
  return !path.startsWith("/") && normalized !== "" && normalized !== ".." &&
    !normalized.startsWith("../") &&
    normalized.toLowerCase().endsWith(".md");
}

function normalizeLinkCardPath(path: string): string {
  // The editor only offers cards whose Markdown can live below the board
  // directory. Refusing invalid inputs here prevents a plausible-looking link
  // from silently pointing at a different card after normalization.
  if (!isLinkableCardPath(path)) {
    throw new Error(
      `Card link path must name Markdown within the board: ${path}`,
    );
  }
  return normalizeCardPath(path);
}

function splitPath(path: string): string[] {
  return path === "" ? [] : path.split("/");
}

function encodeLinkPathSegment(segment: string): string {
  let encoded = "";
  for (const character of segment) {
    const codeUnit = character.charCodeAt(0);
    if (
      codeUnit <= 0x20 || codeUnit === 0x7f ||
      "%()<>#?\\".includes(character)
    ) {
      encoded += `%${codeUnit.toString(16).toUpperCase().padStart(2, "0")}`;
    } else {
      encoded += character;
    }
  }
  return encoded;
}

function escapeLinkText(text: string): string {
  return text.replaceAll("\\", "\\\\").replaceAll("[", "\\[").replaceAll(
    "]",
    "\\]",
  );
}
