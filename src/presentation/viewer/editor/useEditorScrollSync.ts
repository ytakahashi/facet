import { type RefObject, useCallback } from "react";

export function useEditorScrollSync(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  backdropRef: RefObject<HTMLDivElement | null>,
  gutterContentRef: RefObject<HTMLDivElement | null>,
) {
  return useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const backdrop = backdropRef.current;
    if (backdrop) {
      backdrop.scrollTop = textarea.scrollTop;
      backdrop.scrollLeft = textarea.scrollLeft;
    }
    const gutter = gutterContentRef.current;
    if (gutter) {
      // Only the text layers follow horizontal scrolling; numbers stay fixed.
      gutter.style.transform = `translateY(${-textarea.scrollTop}px)`;
    }
  }, [textareaRef, backdropRef, gutterContentRef]);
}
