import type { RefObject } from "react";

interface EditorFindBackdropProps {
  text: string;
  backdropRef: RefObject<HTMLDivElement | null>;
  textRef: RefObject<HTMLSpanElement | null>;
}

export function EditorFindBackdrop(
  { text, backdropRef, textRef }: EditorFindBackdropProps,
) {
  return (
    <div
      className="markdown-editor-backdrop"
      ref={backdropRef}
      aria-hidden="true"
    >
      <span ref={textRef}>{text}</span>
      {
        /* Preserve the final empty line's height without adding padding to
        the searchable text node. */
      }
      <span>{" "}</span>
    </div>
  );
}
