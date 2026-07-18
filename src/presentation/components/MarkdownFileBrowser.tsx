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

interface MarkdownFileBrowserProps {
  root: string;
  selectedPath?: string;
  onSelect: (path: string) => void;
  disabled?: boolean;
}

export function MarkdownFileBrowser({
  root,
  selectedPath,
  onSelect,
  disabled = false,
}: MarkdownFileBrowserProps) {
  const { listDirectory } = useDirectoryBrowsing();
  const [currentDirectory, setCurrentDirectory] = useState(root);
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [error, setError] = useState<UiError>();
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(
    async (path: string) => {
      setIsLoading(true);
      setError(undefined);
      try {
        setEntries(await listDirectory(path));
      } catch (navigationError) {
        setEntries([]);
        setError(toUiError(navigationError));
      } finally {
        setIsLoading(false);
      }
    },
    [listDirectory],
  );

  useEffect(() => {
    setCurrentDirectory(root);
  }, [root]);

  useEffect(() => {
    void load(currentDirectory);
  }, [currentDirectory, load]);

  const visibleEntries = sortDirectoryEntries(entries).filter((entry) =>
    entry.isDirectory || entry.name.toLowerCase().endsWith(".md")
  );

  return (
    <div className="markdown-file-browser">
      <div className="markdown-file-browser__path">
        {currentDirectory !== root && (
          <button
            type="button"
            onClick={() =>
              setCurrentDirectory(parentWithinRoot(currentDirectory, root))}
            disabled={disabled || isLoading}
          >
            Up
          </button>
        )}
        <span title={currentDirectory}>
          {relativePathWithinRoot(currentDirectory, root)}
        </span>
      </div>
      {error && <p role="alert">{error.message}</p>}
      {isLoading && <p>Loading…</p>}
      {!isLoading && !error && visibleEntries.length === 0 && (
        <p className="markdown-file-browser__empty">No Markdown files</p>
      )}
      <ul className="markdown-file-browser__entries">
        {visibleEntries.map((entry) => {
          const path = joinPath(currentDirectory, entry.name);
          return (
            <li key={entry.name}>
              <button
                type="button"
                className={selectedPath === path ? "is-selected" : undefined}
                onClick={() =>
                  entry.isDirectory
                    ? setCurrentDirectory(path)
                    : onSelect(path)}
                disabled={disabled}
              >
                {entry.name}
                {entry.isDirectory ? "/" : ""}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
