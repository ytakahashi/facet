import { useCallback, useEffect, useState } from "react";
import type { DirEntry } from "../../domain/fileSystemPort.ts";
import { useDirectoryBrowsing } from "../directoryBrowsingContext.ts";
import { useBoardStore } from "../store/boardStoreContext.ts";

function joinPath(directory: string, name: string): string {
  return directory.endsWith("/")
    ? `${directory}${name}`
    : `${directory}/${name}`;
}

function parentOf(path: string): string {
  if (path === "/") {
    return "/";
  }
  const index = path.lastIndexOf("/");
  return index <= 0 ? "/" : path.slice(0, index);
}

function isBoardFile(name: string): boolean {
  return name.endsWith(".yaml") || name.endsWith(".yml");
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function DirectoryBrowser() {
  const { listDirectory, homeDirectory } = useDirectoryBrowsing();
  const openBoard = useBoardStore((state) => state.openBoard);
  const status = useBoardStore((state) => state.status);
  const boardError = useBoardStore((state) => state.error);

  const [path, setPath] = useState<string | null>(null);
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [browseError, setBrowseError] = useState<string | null>(null);

  const navigate = useCallback(
    async (nextPath: string) => {
      try {
        setBrowseError(null);
        const nextEntries = await listDirectory(nextPath);
        setPath(nextPath);
        setEntries(nextEntries);
      } catch (error) {
        setBrowseError(toMessage(error));
      }
    },
    [listDirectory],
  );

  useEffect(() => {
    let cancelled = false;
    homeDirectory()
      .then((home) => {
        if (!cancelled) {
          void navigate(home);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setBrowseError(toMessage(error));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [homeDirectory, navigate]);

  function handleEntryClick(entry: DirEntry) {
    if (!path) {
      return;
    }
    const entryPath = joinPath(path, entry.name);
    if (entry.isDirectory) {
      void navigate(entryPath);
    } else if (isBoardFile(entry.name)) {
      void openBoard(entryPath);
    }
  }

  const sortedEntries = [...entries].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="directory-browser">
      <div className="directory-browser__path">
        <button
          type="button"
          onClick={() => path && void navigate(parentOf(path))}
          disabled={!path || path === "/"}
        >
          Up
        </button>
        <span>{path ?? "Loading…"}</span>
      </div>

      {browseError && <p role="alert">{browseError}</p>}
      {status === "loading" && <p>Opening board…</p>}
      {status === "error" && boardError && <p role="alert">{boardError}</p>}

      <ul className="directory-browser__entries">
        {sortedEntries.map((entry) => (
          <li key={entry.name}>
            <button
              type="button"
              className={entry.isDirectory
                ? "directory-browser__entry--directory"
                : "directory-browser__entry--file"}
              onClick={() => handleEntryClick(entry)}
              disabled={!entry.isDirectory && !isBoardFile(entry.name)}
            >
              {entry.isDirectory ? `${entry.name}/` : entry.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
