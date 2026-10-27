import { memo, type RefObject } from "react";
import type { EditorLineLayout } from "./editorLineLayout.ts";

interface EditorLineNumbersProps {
  lineCount: number;
  layout: readonly EditorLineLayout[];
  contentRef: RefObject<HTMLDivElement | null>;
}

export const EditorLineNumbers = memo(function EditorLineNumbers({
  lineCount,
  layout,
  contentRef,
}: EditorLineNumbersProps) {
  return (
    <div
      className="markdown-editor-gutter"
      aria-hidden="true"
      style={{ width: `${String(lineCount).length + 2}ch` }}
    >
      <div className="markdown-editor-gutter-content" ref={contentRef}>
        {Array.from({ length: lineCount }, (_, index) => (
          <span
            key={index}
            className="markdown-editor-line-number"
            hidden={layout[index] === undefined}
            style={{ top: layout[index]?.top }}
          >
            {index + 1}
          </span>
        ))}
      </div>
    </div>
  );
});
