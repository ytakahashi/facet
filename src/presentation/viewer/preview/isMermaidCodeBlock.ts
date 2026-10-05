// The subset of a hast `pre` element this reads. Structural for the same
// reason as `CodeBlockNode`: no direct dependency on hast's type package.
export interface PreElementNode {
  type: string;
  children?: readonly {
    type: string;
    tagName?: string;
    properties?: { className?: unknown };
  }[];
}

// remark-rehype marks a fenced block's info string as a `language-*` class on
// the inner <code>, so a block counts as Mermaid exactly when its fence was
// opened with `mermaid`.
export function isMermaidCodeBlock(node: PreElementNode): boolean {
  const code = node.children?.find((child) =>
    child.type === "element" && child.tagName === "code"
  );
  const className = code?.properties?.className;
  return Array.isArray(className) && className.includes("language-mermaid");
}
