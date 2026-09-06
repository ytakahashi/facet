import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownPreviewProps {
  markdown: string;
}

// Navigation and resource loading stay disabled until the app can handle them
// without replacing the WebView or resolving board files through HTTP.
const PREVIEW_COMPONENTS: Components = {
  a: ({ children, href }) => (
    <span className="markdown-preview__link" title={href}>
      {children}
    </span>
  ),
  img: ({ alt, src }) => (
    <span className="markdown-preview__image" title={src}>
      {alt || "Image"}
    </span>
  ),
};

export function MarkdownPreview({ markdown }: MarkdownPreviewProps) {
  return (
    <div className="markdown-preview">
      <Markdown remarkPlugins={[remarkGfm]} components={PREVIEW_COMPONENTS}>
        {markdown}
      </Markdown>
    </div>
  );
}
