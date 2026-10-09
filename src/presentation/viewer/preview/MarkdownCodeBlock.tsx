import { type ReactNode, useEffect, useState } from "react";

const COPIED_FEEDBACK_MS = 2000;

interface MarkdownCodeBlockProps {
  text: string;
  children: ReactNode;
  // The caller reports a failure itself; a rejection here only means the text
  // was not copied, so the button stays as it was.
  onCopy: (text: string) => Promise<void>;
}

export function MarkdownCodeBlock(
  { text, children, onCopy }: MarkdownCodeBlockProps,
) {
  // A counter rather than a flag: copying again while "Copied" is showing
  // must restart the timer, which an unchanged `true` would not do.
  const [copyCount, setCopyCount] = useState(0);
  const isCopied = copyCount > 0;

  useEffect(() => {
    if (copyCount === 0) return;
    const timer = setTimeout(() => setCopyCount(0), COPIED_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [copyCount]);

  function copy() {
    onCopy(text).then(
      () => setCopyCount((count) => count + 1),
      () => {},
    );
  }

  const label = isCopied ? "Copied" : "Copy code";

  return (
    // The button sits beside the <pre> rather than inside it, so it stays in
    // the corner while a long line scrolls the code horizontally.
    <div className="markdown-preview__code-block">
      <pre>{children}</pre>
      <button
        type="button"
        data-find-ignore
        className={isCopied
          ? "markdown-preview__copy markdown-preview__copy--copied"
          : "markdown-preview__copy"}
        aria-label={label}
        title={label}
        onClick={copy}
      >
        {isCopied ? <CheckIcon /> : <CopyIcon />}
      </button>
    </div>
  );
}

function CopyIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M10.5 5.5V4A1.5 1.5 0 0 0 9 2.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M3 8.5l3 3 7-7" />
    </svg>
  );
}
