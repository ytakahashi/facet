import { findTextMatches, type TextRange } from "../../../domain/textMatch.ts";
import {
  findIndexFromOffset,
  moveFindIndex,
  nearestFindIndex,
} from "./findNavigation.ts";

export interface FindText {
  text: string;
  getVisibleOffset: () => number;
}

export interface MarkdownFindState {
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
  | { type: "open" }
  | { type: "close" }
  | { type: "query"; query: string; visibleOffset?: number }
  | { type: "source"; source: FindText; offset: number }
  | { type: "reset"; position: "first" | "visible" }
  | { type: "move"; direction: 1 | -1 };

export function reduceMarkdownFind(
  state: MarkdownFindState,
  action: MarkdownFindAction,
): MarkdownFindState {
  switch (action.type) {
    case "open":
      return { ...state, isOpen: true, focusToken: state.focusToken + 1 };
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
    case "reset":
      return {
        ...state,
        source: undefined,
        ranges: [],
        activeIndex: undefined,
        initialPosition: action.position,
      };
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
