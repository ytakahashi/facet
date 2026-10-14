import { useState } from "react";
import { useDirectoryListing } from "./useDirectoryListing.ts";
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

export function MarkdownFileBrowser(props: MarkdownFileBrowserProps) {
  // A different root starts a new navigation session before any child renders.
  return <RootFileBrowser key={props.root} {...props} />;
}

function RootFileBrowser({
  root,
  selectedPath,
  onSelect,
  disabled = false,
}: MarkdownFileBrowserProps) {
  const [currentDirectory, setCurrentDirectory] = useState(root);
  const { entries, error, isLoading } = useDirectoryListing(currentDirectory);

  const visibleEntries = sortDirectoryEntries(entries).filter(
    (entry) => entry.isDirectory || entry.name.toLowerCase().endsWith(".md"),
  );

  return (
    <div className="markdown-file-browser">
      <div className="markdown-file-browser__path">
        {currentDirectory !== root && (
          <button
            type="button"
            onClick={() =>
              setCurrentDirectory(parentWithinRoot(currentDirectory, root))
            }
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
                  entry.isDirectory ? setCurrentDirectory(path) : onSelect(path)
                }
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
