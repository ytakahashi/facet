export interface LinkInsertionTarget {
  start: number;
  end: number;
  linkText?: string;
}

export interface LinkInsertionResult {
  value: string;
  caret: number;
}

export function resolveLinkInsertionTarget(
  value: string,
  selectionStart: number,
  selectionEnd: number,
): LinkInsertionTarget {
  const start = Math.min(selectionStart, selectionEnd);
  const end = Math.max(selectionStart, selectionEnd);
  if (start === end) return { start, end };

  const selected = value.slice(start, end);
  if (/\r|\n/.test(selected)) {
    // Replacing several lines could delete whole paragraphs accidentally, so
    // preserve them and insert after the selection instead.
    return { start: end, end };
  }
  return { start, end, linkText: selected };
}

export function applyLinkInsertion(
  value: string,
  target: LinkInsertionTarget,
  markdown: string,
): LinkInsertionResult {
  return {
    value: value.slice(0, target.start) + markdown + value.slice(target.end),
    caret: target.start + markdown.length,
  };
}
