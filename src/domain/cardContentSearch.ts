import type { Board } from "./board.ts";
import type { Card } from "./card.ts";
import { canonicalSearchQuery, canonicalSearchText } from "./searchText.ts";

// These are presentation-oriented initial limits rather than search
// correctness constraints: keep one card from dominating the result list,
// retain some context before its first match, and bound very long log lines.
const MAX_VISIBLE_LINES = 3;
const SNIPPET_LEADING_CODE_POINTS = 30;
const MAX_SNIPPET_CODE_POINTS = 120;

export interface TextRange {
  // Offsets use JavaScript's UTF-16 string indices so presentation can pass
  // them directly to String.slice when rendering highlighted segments.
  start: number;
  end: number;
}

export interface ContentLineHit {
  lineNumber: number;
  snippet: string;
  truncatedStart: boolean;
  truncatedEnd: boolean;
  ranges: TextRange[];
}

export interface CardContentSearchHit {
  card: Card;
  columnId: string;
  columnName: string;
  lines: ContentLineHit[];
  totalLineCount: number;
}

// Contents must be keyed by the exact board-relative path held by each Card.
// Deliberately do not fold paths as boardPath does: readers produce results
// for those same Card objects, and accepting a differently spelled key here
// would hide a broken handoff between reading and searching.
//
// Results follow board order (columns, then cards within a column), matching
// the stable order already visible to the user for every repeated query.
export function searchCardContents(
  board: Board,
  contents: ReadonlyMap<string, string>,
  query: string,
): CardContentSearchHit[] {
  const canonicalQuery = canonicalSearchQuery(query);
  // Unlike title search, content search does not list every card on open: its
  // useful result unit is a matching line, which an empty query cannot name.
  if (canonicalQuery === "") return [];

  const hits: CardContentSearchHit[] = [];
  for (const column of board.columns) {
    for (const card of column.cards) {
      const content = contents.get(card.path);
      if (content === undefined) continue;

      const lineHits = findLineHits(content, canonicalQuery);
      if (lineHits.length === 0) continue;

      hits.push({
        card,
        columnId: column.id,
        columnName: column.name,
        lines: lineHits.slice(0, MAX_VISIBLE_LINES),
        totalLineCount: lineHits.length,
      });
    }
  }
  return hits;
}

function findLineHits(
  content: string,
  canonicalQuery: string,
): ContentLineHit[] {
  const hits: ContentLineHit[] = [];
  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const hit = matchLine(lines[index], canonicalQuery, index + 1);
    if (hit) hits.push(hit);
  }
  return hits;
}

function matchLine(
  sourceLine: string,
  canonicalQuery: string,
  lineNumber: number,
): ContentLineHit | undefined {
  const line = sourceLine.normalize("NFC");
  const canonicalLine = canonicalSearchText(line);
  const canonicalRanges = findRanges(canonicalLine, canonicalQuery);
  if (canonicalRanges.length === 0) return undefined;

  // A fold such as İ -> i + combining dot changes UTF-16 length. Its match
  // proves the line is a hit, but the folded offsets cannot safely highlight
  // the source. They are still mapped to a code-point boundary below so a
  // long snippet is centred around the match rather than an unrelated prefix.
  const ranges = canonicalLine.length === line.length ? canonicalRanges : [];
  const anchor = canonicalLine.length === line.length
    ? canonicalRanges[0].start
    : sourceOffsetForFoldedOffset(line, canonicalRanges[0].start);
  return makeSnippet(line, lineNumber, ranges, anchor);
}

function findRanges(text: string, query: string): TextRange[] {
  const ranges: TextRange[] = [];
  let offset = 0;
  while (offset <= text.length - query.length) {
    const start = text.indexOf(query, offset);
    if (start === -1) break;
    const end = start + query.length;
    ranges.push({ start, end });
    offset = end;
  }
  return ranges;
}

function sourceOffsetForFoldedOffset(
  source: string,
  foldedOffset: number,
): number {
  let sourceOffset = 0;
  let currentFoldedOffset = 0;
  for (const codePoint of source) {
    const nextFoldedOffset = currentFoldedOffset +
      canonicalSearchText(codePoint).length;
    if (foldedOffset < nextFoldedOffset) return sourceOffset;
    sourceOffset += codePoint.length;
    currentFoldedOffset = nextFoldedOffset;
  }
  return source.length;
}

function makeSnippet(
  line: string,
  lineNumber: number,
  ranges: TextRange[],
  anchor: number,
): ContentLineHit {
  const boundaries = codePointBoundaries(line);
  const anchorIndex = boundaryIndexAtOrBefore(boundaries, anchor);
  const startIndex = Math.max(0, anchorIndex - SNIPPET_LEADING_CODE_POINTS);
  const endIndex = Math.min(
    boundaries.length - 1,
    startIndex + MAX_SNIPPET_CODE_POINTS,
  );
  const start = boundaries[startIndex];
  const end = boundaries[endIndex];

  return {
    lineNumber,
    snippet: line.slice(start, end),
    truncatedStart: start > 0,
    truncatedEnd: end < line.length,
    ranges: ranges
      .filter((range) => range.start >= start && range.end <= end)
      .map((range) => ({
        start: range.start - start,
        end: range.end - start,
      })),
  };
}

function codePointBoundaries(value: string): number[] {
  const boundaries = [0];
  let offset = 0;
  for (const codePoint of value) {
    offset += codePoint.length;
    boundaries.push(offset);
  }
  return boundaries;
}

function boundaryIndexAtOrBefore(
  boundaries: readonly number[],
  offset: number,
): number {
  for (let index = boundaries.length - 1; index >= 0; index -= 1) {
    if (boundaries[index] <= offset) return index;
  }
  return 0;
}
