import {
  type RefObject,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  type EditorLineLayout,
  measureEditorLines,
} from "./editorLineLayout.ts";

export function useEditorLineLayout(
  lines: readonly string[],
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  syncScroll: () => void,
) {
  const mirrorRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<EditorLineLayout[]>([]);
  const measuredSize = useRef<string | undefined>(undefined);
  const readSize = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return undefined;
    const rect = textarea.getBoundingClientRect();
    // Include fractional box dimensions and changes to scrollbar occupancy.
    return `${rect.width}:${rect.height}:${textarea.clientWidth}:${textarea.clientHeight}`;
  }, [textareaRef]);
  const measure = useCallback(() => {
    const mirror = mirrorRef.current;
    if (!mirror || !textareaRef.current) return;
    measuredSize.current = readSize();
    const next = measureEditorLines(mirror);
    setLayout((previous) =>
      previous.length === next.length &&
      previous.every((line, index) => line.top === next[index].top)
        ? previous
        : next,
    );
    syncScroll();
  }, [textareaRef, readSize, syncScroll]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const observer = new ResizeObserver(() => {
      // observe() also delivers an initial notification. The content effect
      // already measured that size; only changed geometry needs another pass.
      if (readSize() !== measuredSize.current) measure();
    });
    observer.observe(textarea);
    const fonts = textarea.ownerDocument.fonts;
    // Initial layout uses the currently available fonts; a later font load
    // needs remeasurement even when the viewport dimensions stay unchanged.
    fonts.addEventListener("loadingdone", measure);
    return () => {
      observer.disconnect();
      fonts.removeEventListener("loadingdone", measure);
    };
  }, [textareaRef, readSize, measure]);

  useLayoutEffect(() => {
    measure();
  }, [lines, measure]);

  return { mirrorRef, layout };
}
