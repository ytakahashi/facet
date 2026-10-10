import { findTextMatches, type TextRange } from "../../../domain/textMatch.ts";
import {
  findIndexFromOffset,
  moveFindIndex,
  nearestFindIndex,
} from "./findNavigation.ts";

import type { FindText } from "./findPresentation.ts";

export interface MarkdownFindContext {
  cardPath: string | undefined;
  enabled: boolean;
  mode: "edit" | "preview";
}

export interface MarkdownFindState {
  context: MarkdownFindContext;
  isOpen: boolean;
  query: string;
  source: FindText | undefined;
  ranges: TextRange[];
  activeIndex: number | undefined;
  revealToken: number;
  focusToken: number;
  initialPosition: "first" | "visible";
}

export const initialMarkdownFindState: MarkdownFindState = {
  context: { cardPath: undefined, enabled: false, mode: "preview" },
  isOpen: false,
  query: "",
  source: undefined,
  ranges: [],
  activeIndex: undefined,
  revealToken: 0,
  focusToken: 0,
  initialPosition: "first",
};

export type MarkdownFindAction =
  | { type: "open"; query?: string; offset?: number }
  | { type: "close" }
  | { type: "query"; query: string; visibleOffset?: number }
  | { type: "source"; source: FindText; offset: number }
  | { type: "context"; context: MarkdownFindContext }
  | { type: "move"; direction: 1 | -1 };

export function reduceMarkdownFind(
  state: MarkdownFindState,
  action: MarkdownFindAction,
): MarkdownFindState {
  switch (action.type) {
    case "open": {
      if (state.isOpen && action.query === undefined) {
        return { ...state, isOpen: true, focusToken: state.focusToken + 1 };
      }
      const query = action.query ?? state.query;
      const ranges = findTextMatches(state.source?.text ?? "", query);
      const offset =
        action.query === undefined && state.activeIndex !== undefined
          ? state.ranges[state.activeIndex].start
          : action.offset ?? 0;
      return {
        ...state,
        isOpen: true,
        query,
        ranges,
        activeIndex: findIndexFromOffset(ranges, offset),
        initialPosition: "visible",
        focusToken: state.focusToken + 1,
        revealToken: state.revealToken + 1,
      };
    }
    case "close":
      return { ...state, isOpen: false };
    case "query": {
      const ranges = findTextMatches(state.source?.text ?? "", action.query);
      // Navigation places the match below the viewport's top. Refining a
      // query must preserve that match rather than jump to an earlier one.
      const offset = state.activeIndex === undefined
        ? action.visibleOffset ?? 0
        : state.ranges[state.activeIndex].start;
      return {
        ...state,
        query: action.query,
        ranges,
        activeIndex: findIndexFromOffset(ranges, offset),
        initialPosition: "visible",
        revealToken: state.revealToken + 1,
      };
    }
    case "source": {
      // Keep the live selection port available while closed, but avoid the
      // grapheme segmentation and matching cost on every editor keystroke.
      if (!state.isOpen) {
        return {
          ...state,
          source: action.source,
          ranges: [],
          activeIndex: undefined,
        };
      }
      const ranges = findTextMatches(action.source.text, state.query);
      const previousStart = state.activeIndex === undefined
        ? 0
        : state.ranges[state.activeIndex].start;
      const activeIndex = state.source
        ? nearestFindIndex(ranges, previousStart)
        : findIndexFromOffset(
          ranges,
          state.initialPosition === "first" ? 0 : action.offset,
        );
      return { ...state, source: action.source, ranges, activeIndex };
    }
    case "context": {
      const cardChanged = state.context.cardPath !== action.context.cardPath;
      if (
        !cardChanged && state.context.mode === action.context.mode &&
        action.context.enabled
      ) return { ...state, context: action.context };
      return {
        ...state,
        context: action.context,
        source: undefined,
        ranges: [],
        activeIndex: undefined,
        initialPosition: cardChanged ? "first" : "visible",
      };
    }
    case "move":
      return {
        ...state,
        activeIndex: moveFindIndex(
          state.ranges.length,
          state.activeIndex,
          action.direction,
        ),
        revealToken: state.revealToken + 1,
      };
  }
}
