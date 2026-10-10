import type { TextRange } from "../../../domain/textMatch.ts";
import {
  locatePreviewRange,
  type PreviewTextIndex,
} from "./previewTextIndex.ts";

const ALL_MATCHES = "facet-find";
const ACTIVE_MATCH = "facet-find-active";

export function clearFindHighlights() {
  if (typeof CSS === "undefined" || !CSS.highlights) return;
  CSS.highlights.delete(ALL_MATCHES);
  CSS.highlights.delete(ACTIVE_MATCH);
}

export function previewDomRange(
  index: PreviewTextIndex<Text>,
  match: TextRange,
): Range | undefined {
  const positions = locatePreviewRange(index, match);
  if (
    !positions || !positions.start.node.isConnected ||
    !positions.end.node.isConnected ||
    positions.start.offset > positions.start.node.length ||
    positions.end.offset > positions.end.node.length
  ) return undefined;
  const range = positions.start.node.ownerDocument.createRange();
  range.setStart(positions.start.node, positions.start.offset);
  range.setEnd(positions.end.node, positions.end.offset);
  return range;
}

export function setFindHighlights(
  index: PreviewTextIndex<Text>,
  matches: readonly TextRange[],
  activeIndex: number | undefined,
) {
  registerFindHighlights(
    matches.map((match) => previewDomRange(index, match)),
    activeIndex,
  );
}

export function registerFindHighlights(
  ranges: readonly (Range | undefined)[],
  activeIndex: number | undefined,
) {
  clearFindHighlights();
  if (
    typeof CSS === "undefined" || !CSS.highlights ||
    typeof Highlight === "undefined"
  ) return;
  const all = new Highlight();
  const active = new Highlight();
  active.priority = 1;
  ranges.forEach((range, matchIndex) => {
    if (!range) return;
    all.add(range);
    if (matchIndex === activeIndex) active.add(range);
  });
  // Highlight names are global. Only the active board's single Viewer is
  // mounted.
  CSS.highlights.set(ALL_MATCHES, all);
  CSS.highlights.set(ACTIVE_MATCH, active);
}

export function visiblePreviewOffset(
  root: HTMLElement,
  index: PreviewTextIndex<Text>,
): number {
  const top = root.getBoundingClientRect().top + root.clientTop;
  for (const entry of index.nodes) {
    const range = root.ownerDocument.createRange();
    range.selectNodeContents(entry.node);
    for (const rect of range.getClientRects()) {
      if (rect.bottom <= top) continue;
      // A long paragraph may begin above the viewport. Locate the first
      // visible grapheme instead of anchoring every query to the paragraph.
      const segmenter = new Intl.Segmenter(undefined, {
        granularity: "grapheme",
      });
      for (
        const { index: offset, segment } of segmenter.segment(entry.node.data)
      ) {
        range.setStart(entry.node, offset);
        range.setEnd(entry.node, offset + segment.length);
        if (
          Array.from(range.getClientRects()).some((box) => box.bottom > top)
        ) return entry.start + offset;
      }
    }
  }
  return index.text.length;
}

export function revealPreviewRange(root: HTMLElement, range: Range) {
  // Scroll only the preview and nested code blocks, never the board or window.
  const ancestor = range.startContainer.parentElement;
  const pre = ancestor?.closest("pre");
  if (pre && root.contains(pre)) {
    const box = range.getBoundingClientRect();
    const bounds = pre.getBoundingClientRect();
    if (box.left < bounds.left) pre.scrollLeft += box.left - bounds.left;
    else if (box.right > bounds.right) {
      pre.scrollLeft += box.right - bounds.right;
    }
  }
  const box = range.getBoundingClientRect();
  const bounds = root.getBoundingClientRect();
  const top = bounds.top + root.clientTop;
  const bottom = top + root.clientHeight;
  if (box.top < top || box.bottom > bottom) {
    root.scrollTop += box.top - top - root.clientHeight / 3;
  }
}
