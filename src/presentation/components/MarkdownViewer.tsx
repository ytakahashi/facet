import { useMarkdownViewer } from "../context/appContext.ts";
import { MarkdownEditor } from "./MarkdownEditor.tsx";

export function MarkdownViewer() {
  const status = useMarkdownViewer((state) => state.status);
  const draft = useMarkdownViewer((state) => state.draft);
  const content = useMarkdownViewer((state) => state.content);
  const error = useMarkdownViewer((state) => state.error);
  const isSaving = useMarkdownViewer((state) => state.isSaving);
  const saveError = useMarkdownViewer((state) => state.saveError);
  const updateDraft = useMarkdownViewer((state) => state.updateDraft);
  const save = useMarkdownViewer((state) => state.save);
  const close = useMarkdownViewer((state) => state.close);

  const isDirty = draft !== undefined && draft !== content;

  return (
    <div className="markdown-viewer">
      <div className="markdown-viewer__header">
        <button type="button" onClick={save} disabled={!isDirty || isSaving}>
          {isSaving ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={close}>Close</button>
      </div>

      {saveError && <p role="alert">{saveError}</p>}
      {status === "loading" && (
        <p className="markdown-viewer__placeholder">Loading…</p>
      )}
      {status === "error" && error && <p role="alert">{error}</p>}
      {status === "loaded" && draft !== undefined && (
        <MarkdownEditor value={draft} onChange={updateDraft} />
      )}
    </div>
  );
}
