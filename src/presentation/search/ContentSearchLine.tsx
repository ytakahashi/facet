import type { ReactNode } from "react";
import type { ContentLineHit } from "../../domain/cardContentSearch.ts";

export function ContentSearchLine({ hit }: { hit: ContentLineHit }) {
  const content: ReactNode[] = [];
  let offset = 0;
  // The domain returns ranges in ascending order without overlap, allowing
  // this renderer to move one cursor forward without sorting or merging.
  for (const range of hit.ranges) {
    if (range.start > offset) {
      content.push(hit.snippet.slice(offset, range.start));
    }
    content.push(
      <mark key={`match-${range.start}`}>
        {hit.snippet.slice(range.start, range.end)}
      </mark>,
    );
    offset = range.end;
  }
  if (offset < hit.snippet.length) {
    content.push(hit.snippet.slice(offset));
  }

  return (
    <div className="card-content-search-dialog__line">
      <span className="card-content-search-dialog__line-number">
        {hit.lineNumber}:
      </span>
      <span className="card-content-search-dialog__snippet">
        {hit.truncatedStart && "…"}
        {content}
        {hit.truncatedEnd && "…"}
      </span>
    </div>
  );
}
