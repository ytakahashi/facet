import { type RefObject, useEffect, useRef } from "react";
import { resolveFindShortcut } from "./findShortcut.ts";

interface FindBarProps {
  mode: "edit" | "preview";
  query: string;
  count: number;
  activeIndex: number | undefined;
  focusToken: number;
  // Owned by useMarkdownFind so loading a card or switching modes cannot
  // repeat an already consumed focus request when this bar mounts again.
  handledFocusToken: RefObject<number>;
  onQueryChange: (query: string) => void;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
}

export function FindBar(
  {
    mode,
    query,
    count,
    activeIndex,
    focusToken,
    handledFocusToken,
    onQueryChange,
    onNext,
    onPrevious,
    onClose,
  }: FindBarProps,
) {
  const input = useRef<HTMLInputElement>(null);
  const targetName = mode === "edit" ? "editor" : "preview";
  useEffect(() => {
    if (handledFocusToken.current === focusToken || !input.current) return;
    handledFocusToken.current = focusToken;
    input.current.focus();
    input.current.select();
  }, [focusToken, handledFocusToken]);
  return (
    <div
      className="markdown-find"
      role="search"
      aria-label={`Find in Markdown ${targetName}`}
    >
      <input
        ref={input}
        type="text"
        aria-label={`Find in ${targetName}`}
        placeholder={`Find in ${targetName}`}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => {
          const shortcut = resolveFindShortcut(event.nativeEvent);
          if (!shortcut) return;
          event.preventDefault();
          event.stopPropagation();
          if (shortcut === "close") onClose();
          else if (shortcut === "next") onNext();
          else onPrevious();
        }}
      />
      <span
        className={query !== "" && count === 0
          ? "markdown-find__count markdown-find__count--empty"
          : "markdown-find__count"}
        role="status"
      >
        {query === ""
          ? ""
          : count === 0
          ? "No results"
          : `${activeIndex === undefined ? 0 : activeIndex + 1} / ${count}`}
      </span>
      <button
        type="button"
        aria-label="Previous match"
        title="Previous match (⇧Enter / ⌘⇧G)"
        disabled={count === 0}
        onClick={onPrevious}
      >
        ↑
      </button>
      <button
        type="button"
        aria-label="Next match"
        title="Next match (Enter / ⌘G)"
        disabled={count === 0}
        onClick={onNext}
      >
        ↓
      </button>
      <button
        type="button"
        aria-label="Close find"
        title="Close find (Esc)"
        onClick={onClose}
      >
        ×
      </button>
    </div>
  );
}
