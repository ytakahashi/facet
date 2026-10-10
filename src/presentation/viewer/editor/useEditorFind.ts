import {
  type RefObject,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import type { TextRange } from "../../../domain/textMatch.ts";
import type { FindPresentation, FindText } from "../find/findPresentation.ts";
import {
  clearFindHighlights,
  registerFindHighlights,
} from "../find/findHighlights.ts";
import { editorFindText, selectedFindQuery } from "./editorFindText.ts";

function mirrorRange(node: Text, range: TextRange): Range | undefined {
  if (range.start < 0 || range.end > node.length || range.start >= range.end) {
    return undefined;
  }
  const result = node.ownerDocument.createRange();
  result.setStart(node, range.start);
  result.setEnd(node, range.end);
  return result;
}

export function useEditorFind(
  value: string,
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  backdropRef: RefObject<HTMLDivElement | null>,
  textRef: RefObject<HTMLSpanElement | null>,
  find: FindPresentation | undefined,
  onFindTextChange: ((source: FindText) => void) | undefined,
) {
  const text = useMemo(() => editorFindText(value), [value]);
  const revealed = useRef(0);
  const syncScroll = useCallback(() => {
    const textarea = textareaRef.current;
    const backdrop = backdropRef.current;
    if (!textarea || !backdrop) return;
    backdrop.scrollTop = textarea.scrollTop;
    backdrop.scrollLeft = textarea.scrollLeft;
  }, [textareaRef, backdropRef]);
  const source = useMemo<FindText>(() => ({
    text,
    getAnchorOffset: () => textareaRef.current?.selectionStart ?? 0,
    getSelectedQuery: () => {
      const textarea = textareaRef.current;
      if (!textarea || textarea.ownerDocument.activeElement !== textarea) {
        return undefined;
      }
      return selectedFindQuery(
        textarea.value,
        textarea.selectionStart,
        textarea.selectionEnd,
      );
    },
    restoreSelection: (range) => {
      const textarea = textareaRef.current;
      if (!textarea?.isConnected) return;
      textarea.focus({ preventScroll: true });
      // Typing can precede the next source notification. Never restore offsets
      // from the older draft into the newly edited textarea.
      if (range && textarea.value === text) {
        textarea.setSelectionRange(range.start, range.end);
      }
      syncScroll();
    },
  }), [text, textareaRef, syncScroll]);
  useLayoutEffect(() => {
    if (!onFindTextChange) return;
    // Layout publication makes matching and painting finish before the next
    // browser paint, including when typing changes the mirror's text node.
    onFindTextChange(source);
  }, [source, onFindTextChange]);
  useLayoutEffect(() => {
    syncScroll();
    const textarea = textareaRef.current;
    const backdrop = backdropRef.current;
    const node = textRef.current?.firstChild;
    if (
      !textarea || !backdrop || !(node instanceof Text) || !find ||
      find.source !== source || node.data !== text
    ) {
      clearFindHighlights();
      return;
    }
    const ranges = find.ranges.map((match) => mirrorRange(node, match));
    registerFindHighlights(ranges, find.activeIndex);
    if (
      revealed.current !== find.revealToken && find.activeIndex !== undefined
    ) {
      const range = ranges[find.activeIndex];
      if (range) {
        const rect = range.getBoundingClientRect();
        const bounds = textarea.getBoundingClientRect();
        const top = bounds.top + textarea.clientTop;
        if (rect.top < top || rect.bottom > top + textarea.clientHeight) {
          textarea.scrollTop += rect.top - top - textarea.clientHeight / 3;
        }
        const left = bounds.left + textarea.clientLeft;
        if (rect.left < left) textarea.scrollLeft += rect.left - left;
        else if (rect.right > left + textarea.clientWidth) {
          textarea.scrollLeft += rect.right - left - textarea.clientWidth;
        }
        syncScroll();
      }
    }
    // No-result requests are consumed too; subsequent typing must not scroll.
    revealed.current = find.revealToken;
    return clearFindHighlights;
  }, [find, source, text, textareaRef, backdropRef, textRef, syncScroll]);
  return { text, syncScroll };
}
