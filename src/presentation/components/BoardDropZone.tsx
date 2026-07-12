import { useState } from "react";
import type { DragEvent } from "react";
import { useBoardStore } from "../store/boardStoreContext.ts";

// Standard browser File objects never expose a real filesystem path; this is
// a non-standard property some Electron-like webviews add. Whether Deno
// Desktop's webview does too is exactly what this component is here to find
// out, so the result is surfaced in the UI instead of failing silently.
interface FileWithMaybePath extends File {
  path?: string;
}

function extractPath(file: FileWithMaybePath): string | undefined {
  return typeof file.path === "string" && file.path.length > 0
    ? file.path
    : undefined;
}

export function BoardDropZone() {
  const status = useBoardStore((state) => state.status);
  const error = useBoardStore((state) => state.error);
  const openBoard = useBoardStore((state) => state.openBoard);
  const [lastFile, setLastFile] = useState<
    { name: string; path?: string } | null
  >(null);

  function handleFile(file: FileWithMaybePath) {
    const path = extractPath(file);
    setLastFile({ name: file.name, path });
    if (path) {
      void openBoard(path);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
  }

  function handleFileInputChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }

  return (
    <div
      className="board-drop-zone"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <p>Drop a .board.yaml file here</p>
      <label className="board-drop-zone__choose-file">
        Choose File…
        <input
          type="file"
          accept=".yaml,.yml"
          onChange={handleFileInputChange}
        />
      </label>

      {status === "loading" && <p>Loading…</p>}
      {status === "error" && error && <p role="alert">{error}</p>}

      {lastFile && (
        <p className="board-drop-zone__debug">
          {lastFile.path
            ? `Resolved path: ${lastFile.path}`
            : `No absolute path available for "${lastFile.name}" (only a filename was received)`}
        </p>
      )}
    </div>
  );
}
