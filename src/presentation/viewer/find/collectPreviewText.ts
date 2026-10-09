import {
  buildPreviewTextIndex,
  type PreviewTextPart,
} from "./previewTextIndex.ts";

const blockTags = new Set([
  "DIV",
  "P",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "UL",
  "OL",
  "LI",
  "BLOCKQUOTE",
  "PRE",
  "TABLE",
  "THEAD",
  "TBODY",
  "TR",
  "TH",
  "TD",
  "HR",
]);
const textTags = new Set([
  "P",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "PRE",
  "TH",
  "TD",
]);

function containingBlock(node: Node, root: Element): Element {
  let parent = node.parentElement;
  while (parent && parent !== root) {
    if (blockTags.has(parent.tagName)) return parent;
    parent = parent.parentElement;
  }
  return root;
}

export function collectPreviewText(root: HTMLElement) {
  const parts: PreviewTextPart<Text>[] = [];
  const walker = root.ownerDocument.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (
          node instanceof Element && (node.matches("svg, [data-find-ignore]"))
        ) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    },
  );
  let previousBlock: Element | undefined;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node instanceof Element) {
      if (blockTags.has(node.tagName) || node.tagName === "BR") {
        parts.push({ kind: "boundary" });
      }
      continue;
    }
    if (!(node instanceof Text)) continue;
    const block = containingBlock(node, root);
    // react-markdown inserts formatting whitespace between structural nodes.
    // Preserve soft line breaks and code whitespace, but not that formatting.
    if (
      /^\s*$/.test(node.data) && node.data.includes("\n") &&
      !textTags.has(block.tagName)
    ) continue;
    if (previousBlock && previousBlock !== block) {
      parts.push({ kind: "boundary" });
    }
    parts.push({ kind: "text", node, text: node.data });
    previousBlock = block;
  }
  return buildPreviewTextIndex(parts);
}
