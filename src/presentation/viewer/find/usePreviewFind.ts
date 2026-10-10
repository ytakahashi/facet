import {
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { collectPreviewText } from "./collectPreviewText.ts";
import {
  clearFindHighlights,
  previewDomRange,
  revealPreviewRange,
  setFindHighlights,
  visiblePreviewOffset,
} from "./findHighlights.ts";
import type { FindPresentation, FindText } from "./findPresentation.ts";

export function usePreviewFind(
  rootRef: RefObject<HTMLDivElement | null>,
  find: FindPresentation | undefined,
  onFindTextChange: ((source: FindText) => void) | undefined,
) {
  const [snapshot, setSnapshot] = useState<
    { index: ReturnType<typeof collectPreviewText>; source: FindText }
  >();
  const revealed = useRef(0);
  const currentSource = useRef<FindText | undefined>(undefined);
  const flushMutations = useRef<() => void>(() => {});
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !onFindTextChange) return;
    let frame: number | undefined;
    const collect = () => {
      frame = undefined;
      const index = collectPreviewText(root);
      const source: FindText = {
        text: index.text,
        getAnchorOffset: () => {
          flushMutations.current();
          return currentSource.current === source
            ? visiblePreviewOffset(root, index)
            : 0;
        },
      };
      currentSource.current = source;
      setSnapshot({ index, source });
      onFindTextChange(source);
    };
    const schedule = () => {
      // Mutation can precede React's next render; clear stale live Ranges now.
      currentSource.current = undefined;
      clearFindHighlights();
      if (frame === undefined) frame = requestAnimationFrame(collect);
    };
    const observer = new MutationObserver(schedule);
    flushMutations.current = () => {
      // React layout effects run before MutationObserver's microtask. Drain
      // pending records before measuring or painting against the old index.
      if (observer.takeRecords().length > 0) schedule();
    };
    observer.observe(root, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    schedule();
    return () => {
      observer.disconnect();
      flushMutations.current = () => {};
      currentSource.current = undefined;
      if (frame !== undefined) cancelAnimationFrame(frame);
      clearFindHighlights();
    };
  }, [rootRef, onFindTextChange]);

  useLayoutEffect(() => {
    flushMutations.current();
    const root = rootRef.current;
    // A snapshot is an identity, not just equal text: Mermaid replacement can
    // change every node while leaving the searchable string unchanged.
    if (
      !root || !find || !snapshot || find.source !== snapshot.source ||
      currentSource.current !== snapshot.source
    ) {
      clearFindHighlights();
      return;
    }
    setFindHighlights(snapshot.index, find.ranges, find.activeIndex);
    if (
      find.activeIndex !== undefined && revealed.current !== find.revealToken
    ) {
      const range = previewDomRange(
        snapshot.index,
        find.ranges[find.activeIndex],
      );
      if (range) revealPreviewRange(root, range);
    }
    // Consume requests even at zero results: a later DOM update that adds a
    // match must not turn an old query's request into an unsolicited scroll.
    revealed.current = find.revealToken;
    return clearFindHighlights;
  }, [rootRef, find, snapshot]);
}
