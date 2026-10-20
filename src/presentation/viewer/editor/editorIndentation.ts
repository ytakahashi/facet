// Two spaces nest a list item under a "- " bullet, the most common marker, and
// keep the source readable where a tab would be rendered eight columns wide.
const INDENT = "  ";

export type IndentDirection = "indent" | "outdent";

export interface IndentationEdit {
  // The range of the original value to replace with `text`.
  start: number;
  end: number;
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

// Offsets are into the textarea's own value, whose newlines are always LF.
export function resolveIndentation(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  direction: IndentDirection,
): IndentationEdit | undefined {
  const start = Math.min(selectionStart, selectionEnd);
  const end = Math.max(selectionStart, selectionEnd);
  const selected = value.slice(start, end);

  if (direction === "indent" && !selected.includes("\n")) {
    const caret = start + INDENT.length;
    return {
      start,
      end,
      text: INDENT,
      selectionStart: caret,
      selectionEnd: caret,
    };
  }

  const blockStart = value.lastIndexOf("\n", start - 1) + 1;
  // A selection that ends at the start of a line, as selecting whole lines
  // does, leaves that line out.
  const lastEnd = end > start && value[end - 1] === "\n" ? end - 1 : end;
  const newline = value.indexOf("\n", lastEnd);
  const blockEnd = newline === -1 ? value.length : newline;

  let offset = blockStart;
  // Each line's start offset in the original value and the characters it
  // gains (positive) or loses (negative) there.
  const shifts: { at: number; delta: number }[] = [];
  const lines = value
    .slice(blockStart, blockEnd)
    .split("\n")
    .map((line) => {
      const at = offset;
      offset += line.length + 1;
      if (direction === "indent") {
        // Blank lines stay empty rather than gaining trailing whitespace.
        if (line === "") return line;
        shifts.push({ at, delta: INDENT.length });
        return INDENT + line;
      }
      const removed = line.startsWith("\t")
        ? 1
        : (/^ {1,2}/.exec(line)?.[0].length ?? 0);
      if (removed > 0) shifts.push({ at, delta: -removed });
      return line.slice(removed);
    });
  if (shifts.length === 0) return undefined;

  function map(position: number): number {
    let mapped = position;
    for (const { at, delta } of shifts) {
      // Indentation added at a line start stays before a caret placed there,
      // so a selection of whole lines keeps covering them; removed
      // indentation pulls a caret inside it back to the line start.
      if (delta > 0 && at < position) mapped += delta;
      if (delta < 0 && at < position) mapped -= Math.min(-delta, position - at);
    }
    return mapped;
  }

  return {
    start: blockStart,
    end: blockEnd,
    text: lines.join("\n"),
    selectionStart: map(start),
    selectionEnd: map(end),
  };
}

export function applyIndentation(value: string, edit: IndentationEdit): string {
  return value.slice(0, edit.start) + edit.text + value.slice(edit.end);
}
