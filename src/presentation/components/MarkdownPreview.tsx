import { useMemo } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Card } from "../../domain/card.ts";

interface MarkdownPreviewProps {
  markdown: string;
  resolveLink?: (href: string) => Card | undefined;
  onOpenCard?: (card: Card) => void;
}

export function MarkdownPreview({
  markdown,
  resolveLink,
  onOpenCard,
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
  }), [onOpenCard, resolveLink]);

  return (
    <div className="markdown-preview">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </Markdown>
    </div>
  );
}
