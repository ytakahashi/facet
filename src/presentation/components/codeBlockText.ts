// The subset of a hast node this reads. Structural so the presentation layer
// does not take a direct dependency on hast's type package.
export interface CodeBlockNode {
  type: string;
  value?: string;
  children?: readonly CodeBlockNode[];
}

// The text a fenced or indented code block holds, as the user wrote it.
// mdast-util-to-hast appends one "\n" to every non-empty code block, so exactly
// one trailing newline is removed; any further blank lines are the author's.
export function codeBlockText(node: CodeBlockNode): string {
  const text = collectText(node);
  return text.endsWith("\n") ? text.slice(0, -1) : text;
}

function collectText(node: CodeBlockNode): string {
  if (node.type === "text") return node.value ?? "";
  return (node.children ?? []).map(collectText).join("");
}
