import { memo, type RefObject } from "react";

interface EditorLineMirrorProps {
  // LF-normalized display text, including the final empty line.
  lines: readonly string[];
  mirrorRef: RefObject<HTMLDivElement | null>;
}

export const EditorLineMirror = memo(function EditorLineMirror({
  lines,
  mirrorRef,
}: EditorLineMirrorProps) {
  return (
    <div
      className="markdown-editor-line-mirror"
      ref={mirrorRef}
      aria-hidden="true"
    >
      {lines.map((line, index) => (
        // An empty block needs an inline box to retain one line of height.
        <div key={index}>{line === "" ? "\u200b" : line}</div>
      ))}
    </div>
  );
});
