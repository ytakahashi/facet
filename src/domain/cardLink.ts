import type { Board } from "./board.ts";
import { findCardByEquivalentPath } from "./board.ts";
import { directoryOf, normalizeCardPath } from "./boardPath.ts";
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
