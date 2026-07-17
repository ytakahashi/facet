import { useCallback, useEffect, useState } from "react";
import type { DirEntry } from "../../domain/fileSystemPort.ts";
import { useDirectoryBrowsing } from "../context/appContext.ts";
import type { UiError } from "../errors/toUiError.ts";
import { toUiError } from "../errors/toUiError.ts";
import {
  joinPath,
  parentWithinRoot,
  relativePathWithinRoot,
  sortDirectoryEntries,
} from "./pathNavigation.ts";

interface BoardDirectoryPickerProps {
  root: string;
  value: string;
  onChange: (path: string) => void;
}

export function BoardDirectoryPicker({
  root,
  value,
  onChange,
}: BoardDirectoryPickerProps) {
  const { listDirectory, createDirectory } = useDirectoryBrowsing();
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [error, setError] = useState<UiError>();
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newDirectoryName, setNewDirectoryName] = useState("");
  const [createError, setCreateError] = useState<UiError>();

  const load = useCallback(
    async (path: string) => {
      setIsLoading(true);
      setError(undefined);
      try {
        const nextEntries = await listDirectory(path);
        setEntries(nextEntries);
      } catch (navigationError) {
        setError(toUiError(navigationError));
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

  async function handleCreateDirectory() {
    setCreateError(undefined);
    try {
      const createdPath = await createDirectory(value, newDirectoryName);
      setNewDirectoryName("");
      setIsCreating(false);
      onChange(createdPath);
    } catch (creationError) {
      setCreateError(toUiError(creationError));
    }
  }

  return (
    <div className="board-directory-picker">
      <div className="board-directory-picker__path">
        {value !== root && (
          <button
            type="button"
            onClick={() => onChange(parentWithinRoot(value, root))}
            disabled={isLoading}
          >
            Up
          </button>
        )}
        <span title={value}>{relativePathWithinRoot(value, root)}</span>
      </div>
      {error && <p role="alert">{error.message}</p>}
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
      {isCreating
        ? (
          <div className="board-directory-picker__create">
            <input
              type="text"
              value={newDirectoryName}
              onChange={(event) => setNewDirectoryName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleCreateDirectory();
                }
              }}
              placeholder="Directory name"
              aria-label="New directory name"
              autoFocus
            />
            <button
              type="button"
              onClick={() => void handleCreateDirectory()}
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setNewDirectoryName("");
                setCreateError(undefined);
              }}
            >
              Cancel
            </button>
          </div>
        )
        : (
          <button
            type="button"
            className="board-directory-picker__new"
            onClick={() => setIsCreating(true)}
          >
            + New directory
          </button>
        )}
      {createError && <p role="alert">{createError.message}</p>}
    </div>
  );
}
