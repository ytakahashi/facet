import type { CardFileState } from "../../domain/card.ts";

// The two broken states are told apart by wording rather than by two badges:
// what to do about them differs, but neither is something the tile itself can
// fix.
export function missingHint(fileState: CardFileState): string {
  if (fileState === "unresolvable") {
    return "This card's path must point inside the board directory.";
  }
  if (fileState === "unreadable") {
    return "The file at this path could not be read.";
  }
  return "No file at this path.";
}
