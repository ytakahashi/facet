import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import {
  initialMarkdownFindState,
  reduceMarkdownFind,
} from "./markdownFindState.ts";
import type { FindText } from "./findPresentation.ts";

export function useMarkdownFind(
  cardPath: string | undefined,
  enabled: boolean,
  mode: "edit" | "preview",
) {
  const [state, dispatch] = useReducer(
    reduceMarkdownFind,
    {
      ...initialMarkdownFindState,
      context: { cardPath, enabled, mode },
    },
  );
  // Reset during the owner's render, before a child can publish its source
  // in a layout effect. A later effect would erase that fresh snapshot.
  if (
    state.context.cardPath !== cardPath || state.context.enabled !== enabled ||
    state.context.mode !== mode
  ) dispatch({ type: "context", context: { cardPath, enabled, mode } });
  const currentState = useRef(state);
  // Stable event callbacks read the latest committed state, without exposing
  // an unfinished render or reinstalling the viewer's keyboard listener.
  useLayoutEffect(() => {
    currentState.current = state;
  }, [state]);
  const handledFocusToken = useRef(0);
  const { isOpen, source, ranges, activeIndex, revealToken } = state;
  const presentation = useMemo(
    () => isOpen ? { source, ranges, activeIndex, revealToken } : undefined,
    [isOpen, source, ranges, activeIndex, revealToken],
  );
  const onFindTextChange = useCallback((nextSource: FindText) => {
    dispatch({
      type: "source",
      source: nextSource,
      offset: nextSource.getAnchorOffset(),
    });
  }, []);
  const open = useCallback(() => {
    const state = currentState.current;
    const query = state.source?.getSelectedQuery?.();
    dispatch({
      type: "open",
      query,
      offset: state.source?.getAnchorOffset(),
    });
  }, []);
  const close = useCallback((options: { restoreSelection: boolean }) => {
    const state = currentState.current;
    const range = state.activeIndex === undefined
      ? undefined
      : state.ranges[state.activeIndex];
    if (options.restoreSelection) state.source?.restoreSelection?.(range);
    dispatch({ type: "close" });
  }, []);
  const next = useCallback(() => dispatch({ type: "move", direction: 1 }), []);
  const previous = useCallback(
    () => dispatch({ type: "move", direction: -1 }),
    [],
  );
  const setQuery = useCallback((query: string) => {
    const state = currentState.current;
    dispatch({
      type: "query",
      query,
      visibleOffset: state.activeIndex === undefined
        ? state.source?.getAnchorOffset()
        : undefined,
    });
  }, []);
  return {
    ...state,
    presentation,
    handledFocusToken,
    open,
    close,
    next,
    previous,
    setQuery,
    onFindTextChange,
  };
}
