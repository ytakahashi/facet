import type { TextRange } from "../../../domain/textMatch.ts";

export type PreviewTextPart<Node> =
  | { kind: "text"; node: Node; text: string }
  | { kind: "boundary" };

export interface PreviewTextIndex<Node> {
  text: string;
  nodes: { node: Node; start: number; end: number }[];
}

export function buildPreviewTextIndex<Node>(
  parts: readonly PreviewTextPart<Node>[],
): PreviewTextIndex<Node> {
  let text = "";
  const nodes: PreviewTextIndex<Node>["nodes"] = [];
  let boundary = false;
  for (const part of parts) {
    if (part.kind === "boundary") {
      boundary = true;
      continue;
    }
    if (part.text === "") continue;
    if (
      boundary && text !== "" && !text.endsWith("\n") &&
      !part.text.startsWith("\n")
    ) text += "\n";
    boundary = false;
    const start = text.length;
    text += part.text;
    nodes.push({ node: part.node, start, end: text.length });
  }
  return { text, nodes };
}

export function locatePreviewRange<Node>(
  index: PreviewTextIndex<Node>,
  range: TextRange,
): {
  start: { node: Node; offset: number };
  end: { node: Node; offset: number };
} | undefined {
  if (
    range.start < 0 || range.end > index.text.length || range.start >= range.end
  ) return undefined;
  // A document can have many nodes and many matches. Binary searches avoid
  // walking the entire node list again for each highlight.
  const first = nodeEndingAfter(index.nodes, range.start);
  const last = nodeEndingAfter(index.nodes, range.end - 1);
  // Virtual newlines have no DOM node. Only ranges with real endpoints can
  // become DOM Ranges; at adjacent nodes, start belongs to the following node.
  if (!first || !last || first.start > range.start || last.start >= range.end) {
    return undefined;
  }
  return {
    start: { node: first.node, offset: range.start - first.start },
    end: { node: last.node, offset: range.end - last.start },
  };
}

function nodeEndingAfter<Node>(
  nodes: PreviewTextIndex<Node>["nodes"],
  offset: number,
) {
  let start = 0;
  let end = nodes.length;
  while (start < end) {
    const middle = Math.floor((start + end) / 2);
    if (nodes[middle].end <= offset) start = middle + 1;
    else end = middle;
  }
  return nodes[start];
}
