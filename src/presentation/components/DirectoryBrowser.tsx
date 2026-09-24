import { useCallback, useEffect, useState } from "react";
import type { DirEntry } from "../../domain/fileSystemPort.ts";
import { useDirectoryBrowsing, useWorkspace } from "../context/appContext.ts";
import type { UiError } from "../errors/toUiError.ts";
import { toUiError } from "../errors/toUiError.ts";
import {
  joinPath,
  parentWithinRoot,
  sortDirectoryEntries,
} from "./pathNavigation.ts";

function isBoardFile(name: string): boolean {
  return name.endsWith(".yaml") || name.endsWith(".yml");
}

export function DirectoryBrowser() {
  const { listDirectory, homeDirectory } = useDirectoryBrowsing();
  const openBoard = useWorkspace((state) => state.openBoard);

  const [path, setPath] = useState<string | null>(null);
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [browseError, setBrowseError] = useState<UiError>();

  const navigate = useCallback(
    async (nextPath: string) => {
      try {
        setBrowseError(undefined);
        const nextEntries = await listDirectory(nextPath);
        setPath(nextPath);
        setEntries(nextEntries);
      } catch (error) {
        setBrowseError(toUiError(error));
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
          setBrowseError(toUiError(error));
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
      openBoard(entryPath);
    }
  }

  const sortedEntries = sortDirectoryEntries(entries);

  return (
    <div className="directory-browser">
      <div className="directory-browser__path">
        <button
          type="button"
          onClick={() => path && void navigate(parentWithinRoot(path, "/"))}
          disabled={!path || path === "/"}
        >
          Up
        </button>
        <span>{path ?? "Loading…"}</span>
      </div>

      {browseError && <p role="alert">{browseError.message}</p>}
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
