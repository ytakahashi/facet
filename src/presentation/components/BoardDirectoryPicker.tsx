import { useCallback, useEffect, useState } from "react";
import type { DirEntry } from "../../domain/fileSystemPort.ts";
import { useDirectoryBrowsing } from "../context/appContext.ts";
import {
  joinPath,
  parentWithinRoot,
  sortDirectoryEntries,
} from "./pathNavigation.ts";

interface BoardDirectoryPickerProps {
  root: string;
  value: string;
  onChange: (path: string) => void;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function BoardDirectoryPicker({
  root,
  value,
  onChange,
}: BoardDirectoryPickerProps) {
  const { listDirectory } = useDirectoryBrowsing();
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(
    async (path: string) => {
      setIsLoading(true);
      setError(undefined);
      try {
        const nextEntries = await listDirectory(path);
        setEntries(nextEntries);
      } catch (navigationError) {
        setError(toMessage(navigationError));
      } finally {
        setIsLoading(false);
      }
    },
    [listDirectory],
  );

  useEffect(() => {
    void load(value);
  }, [load, value]);

  const directories = sortDirectoryEntries(entries).filter((entry) =>
    entry.isDirectory
  );

  return (
    <div className="board-directory-picker">
      <div className="board-directory-picker__path">
        <button
          type="button"
          onClick={() => onChange(parentWithinRoot(value, root))}
          disabled={value === root || isLoading}
        >
          Up
        </button>
        <span title={value}>{value}</span>
      </div>
      {error && <p role="alert">{error}</p>}
      {isLoading && <p>Loading…</p>}
      {!isLoading && directories.length === 0 && (
        <p className="board-directory-picker__empty">No subdirectories</p>
      )}
      <ul className="board-directory-picker__entries">
        {directories.map((entry) => (
          <li key={entry.name}>
            <button
              type="button"
              onClick={() => onChange(joinPath(value, entry.name))}
            >
              {entry.name}/
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
