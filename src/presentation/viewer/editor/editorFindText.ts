export function editorFindText(value: string): string {
  // textarea's API value and selection offsets use LF-normalized newlines.
  // Normalize only the displayed search source, never the stored draft.
  return value.replace(/\r\n?/g, "\n");
}

export function selectedFindQuery(
  text: string,
  start: number,
  end: number,
): string | undefined {
  const selected = text.slice(Math.min(start, end), Math.max(start, end));
  return selected !== "" && !/[\r\n]/.test(selected) ? selected : undefined;
}
