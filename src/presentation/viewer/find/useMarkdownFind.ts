import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import {
  type FindText,
  initialMarkdownFindState,
  reduceMarkdownFind,
} from "./markdownFindState.ts";

export function useMarkdownFind(
  cardPath: string | undefined,
  enabled: boolean,
) {
  const [state, dispatch] = useReducer(
    reduceMarkdownFind,
    initialMarkdownFindState,
  );
  const handledFocusToken = useRef(0);
  const { isOpen, source, ranges, activeIndex, revealToken } = state;
  const previewFind = useMemo(
    () => isOpen ? { source, ranges, activeIndex, revealToken } : undefined,
    [isOpen, source, ranges, activeIndex, revealToken],
  );
  const previousPath = useRef(cardPath);
  useEffect(() => {
    const cardChanged = previousPath.current !== cardPath;
    previousPath.current = cardPath;
    if (cardChanged || !enabled) {
      dispatch({ type: "reset", position: cardChanged ? "first" : "visible" });
    }
  }, [cardPath, enabled]);
  const onFindTextChange = useCallback((nextSource: FindText) => {
    dispatch({
      type: "source",
      source: nextSource,
      offset: nextSource.getVisibleOffset(),
    });
  }, []);
  const open = useCallback(() => dispatch({ type: "open" }), []);
  const close = useCallback(() => dispatch({ type: "close" }), []);
  const next = useCallback(() => dispatch({ type: "move", direction: 1 }), []);
  const previous = useCallback(
    () => dispatch({ type: "move", direction: -1 }),
    [],
  );
  function setQuery(query: string) {
    dispatch({
      type: "query",
      query,
      visibleOffset: state.activeIndex === undefined
        ? state.source?.getVisibleOffset()
        : undefined,
    });
  }
  return {
    ...state,
    previewFind,
    handledFocusToken,
    open,
    close,
    next,
    previous,
    setQuery,
    onFindTextChange,
  };
}
