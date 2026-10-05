import { useMemo } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Card } from "../../../domain/card.ts";
import { codeBlockText } from "./codeBlockText.ts";
import { isMermaidCodeBlock } from "./isMermaidCodeBlock.ts";
import { MarkdownCodeBlock } from "./MarkdownCodeBlock.tsx";
import { MermaidDiagram } from "./MermaidDiagram.tsx";

interface MarkdownPreviewProps {
  markdown: string;
  resolveLink?: (href: string) => Card | undefined;
  onOpenCard?: (card: Card) => void;
  // Keep this stable across renders. A change to any of these callbacks
  // rebuilds `components`, which remounts every code block, dropping its
  // "Copied" state and redrawing every Mermaid diagram.
  onCopyCode?: (text: string) => Promise<void>;
}

export function MarkdownPreview({
  markdown,
  resolveLink,
  onOpenCard,
  onCopyCode,
}: MarkdownPreviewProps) {
  const components = useMemo<Components>(() => ({
    // Card links are buttons rather than anchors so no interaction path,
    // including modified clicks or dragging, can navigate the WebView.
    a: ({ children, href }) => {
      const card = href ? resolveLink?.(href) : undefined;
      if (card && onOpenCard) {
        return (
          <button
            type="button"
            className="markdown-preview__link markdown-preview__link--card"
            title={card.path}
            onClick={() => onOpenCard(card)}
          >
            {children}
          </button>
        );
      }
      return (
        <span className="markdown-preview__link" title={href}>
          {children}
        </span>
      );
    },
    // Resource loading stays disabled: board files are not served over HTTP,
    // and preview content must never navigate or replace the WebView.
    img: ({ alt, src }) => (
      <span className="markdown-preview__image" title={src}>
        {alt || "Image"}
      </span>
    ),
    // Only block code is wrapped: inline `code` never reaches `pre`.
    pre: ({ children, node }) => {
      if (!node) {
        throw new Error("react-markdown passes the hast node to components");
      }
      const text = codeBlockText(node);
      const codeBlock = onCopyCode
        ? (
          <MarkdownCodeBlock text={text} onCopy={onCopyCode}>
            {children}
          </MarkdownCodeBlock>
        )
        : <pre>{children}</pre>;
      return isMermaidCodeBlock(node)
        ? <MermaidDiagram source={text} fallback={codeBlock} />
        : codeBlock;
    },
  }), [onCopyCode, onOpenCard, resolveLink]);

  return (
    <div className="markdown-preview">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </Markdown>
    </div>
  );
}
