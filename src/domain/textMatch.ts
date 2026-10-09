import { canonicalSearchText } from "./searchText.ts";

export interface TextRange {
  // Offsets refer to the original string and use JavaScript's UTF-16 indices.
  start: number;
  end: number;
}

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export function findTextMatches(text: string, query: string): TextRange[] {
  const needle = canonicalSearchText(query);
  if (needle === "") return [];

  const folded = canonicalSearchText(text);
  const boundaries = new Map<number, number>([[0, 0]]);
  let foldedOffset = 0;
  for (const { segment, index } of graphemes.segment(text)) {
    foldedOffset += canonicalSearchText(segment).length;
    boundaries.set(foldedOffset, index + segment.length);
  }
  // Fold the whole string, not the concatenated clusters: lowercase sigma
  // depends on surrounding letters. Cluster lengths still map its boundaries.
  const matches: TextRange[] = [];
  let offset = 0;
  while (offset <= folded.length - needle.length) {
    const start = folded.indexOf(needle, offset);
    if (start === -1) break;
    const end = start + needle.length;
    const sourceStart = boundaries.get(start);
    const sourceEnd = boundaries.get(end);
    if (sourceStart !== undefined && sourceEnd !== undefined) {
      matches.push({ start: sourceStart, end: sourceEnd });
      offset = end;
    } else {
      // A partial grapheme must not hide a later, complete match.
      offset = start + 1;
    }
  }
  return matches;
}
