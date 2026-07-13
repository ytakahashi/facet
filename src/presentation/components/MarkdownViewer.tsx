import { useMarkdownViewer } from "../context/appContext.ts";

export function MarkdownViewer() {
  const status = useMarkdownViewer((state) => state.status);
  const content = useMarkdownViewer((state) => state.content);
  const error = useMarkdownViewer((state) => state.error);
  const close = useMarkdownViewer((state) => state.close);

  return (
    <div className="markdown-viewer">
      <div className="markdown-viewer__header">
        <button type="button" onClick={close}>Close</button>
      </div>

      {status === "loading" && (
        <p className="markdown-viewer__placeholder">Loading…</p>
      )}
      {status === "error" && error && <p role="alert">{error}</p>}
      {status === "loaded" && (
        <pre className="markdown-viewer__content">{content}</pre>
      )}
    </div>
  );
}
