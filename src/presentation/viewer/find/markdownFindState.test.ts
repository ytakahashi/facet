import { describe, expect, it } from "vitest";
import {
  type FindText,
  initialMarkdownFindState,
  reduceMarkdownFind,
} from "./markdownFindState.ts";

function source(text: string, offset = 0): FindText {
  return { text, getVisibleOffset: () => offset };
}

describe("Markdown find state", () => {
  it("keeps the current match when refining a query even if earlier matches are visible", () => {
    let state = reduceMarkdownFind(initialMarkdownFindState, {
      type: "source",
      source: source("foo foo foo foo foo"),
      offset: 0,
    });
    state = reduceMarkdownFind(state, {
      type: "query",
      query: "fo",
      visibleOffset: 0,
    });
    for (let index = 0; index < 4; index += 1) {
      state = reduceMarkdownFind(state, { type: "move", direction: 1 });
    }
    state = reduceMarkdownFind(state, {
      type: "query",
      query: "foo",
    });
    expect(state.activeIndex).toBe(4);
    expect(state.ranges[state.activeIndex!].start).toBe(16);
  });

  it("continues after the previous start if the current match no longer matches", () => {
    let state = reduceMarkdownFind(initialMarkdownFindState, {
      type: "source",
      source: source("foo forest foo"),
      offset: 0,
    });
    state = reduceMarkdownFind(state, {
      type: "query",
      query: "fo",
      visibleOffset: 0,
    });
    state = reduceMarkdownFind(state, { type: "move", direction: 1 });
    state = reduceMarkdownFind(state, {
      type: "query",
      query: "foo",
    });
    expect(state.activeIndex).toBe(1);
    expect(state.ranges[state.activeIndex!].start).toBe(11);
    state = reduceMarkdownFind(state, {
      type: "query",
      query: "forest",
    });
    expect(state.activeIndex).toBe(0);
    expect(state.ranges[state.activeIndex!].start).toBe(4);
  });

  it("uses the visible offset again after a query has no current match", () => {
    let state = reduceMarkdownFind(initialMarkdownFindState, {
      type: "source",
      source: source("foo foo foo"),
      offset: 0,
    });
    state = reduceMarkdownFind(state, {
      type: "query",
      query: "missing",
      visibleOffset: 0,
    });
    expect(state.activeIndex).toBeUndefined();
    state = reduceMarkdownFind(state, {
      type: "query",
      query: "foo",
      visibleOffset: 8,
    });
    expect(state.activeIndex).toBe(2);
  });

  it("starts query matches at the visible offset and requests revealing only for user actions", () => {
    let state = reduceMarkdownFind(initialMarkdownFindState, {
      type: "source",
      source: source("a a a"),
      offset: 0,
    });
    state = reduceMarkdownFind(state, {
      type: "query",
      query: "a",
      visibleOffset: 2,
    });
    expect(state.activeIndex).toBe(1);
    expect(state.revealToken).toBe(1);
    state = reduceMarkdownFind(state, { type: "move", direction: -1 });
    expect(state.activeIndex).toBe(0);
    expect(state.revealToken).toBe(2);
  });
  it("keeps the closest match across DOM changes without scrolling", () => {
    let state = reduceMarkdownFind(initialMarkdownFindState, {
      type: "source",
      source: source("a   a"),
      offset: 0,
    });
    state = reduceMarkdownFind(state, {
      type: "query",
      query: "a",
      visibleOffset: 4,
    });
    const replacement = source("a    a");
    state = reduceMarkdownFind(state, {
      type: "source",
      source: replacement,
      offset: 0,
    });
    expect(state.source).toBe(replacement);
    expect(state.activeIndex).toBe(1);
    expect(state.revealToken).toBe(1);
    state = reduceMarkdownFind(state, {
      type: "source",
      source: source("nothing"),
      offset: 0,
    });
    expect(state.activeIndex).toBeUndefined();
  });
  it("preserves the query and bar across a card change but resets to the first match", () => {
    let state = reduceMarkdownFind(initialMarkdownFindState, { type: "open" });
    state = reduceMarkdownFind(state, {
      type: "query",
      query: "a",
      visibleOffset: 0,
    });
    state = reduceMarkdownFind(state, { type: "reset", position: "first" });
    state = reduceMarkdownFind(state, {
      type: "source",
      source: source("a a a", 4),
      offset: 4,
    });
    expect(state.isOpen).toBe(true);
    expect(state.query).toBe("a");
    expect(state.activeIndex).toBe(0);
  });
  it("uses the visible position when a pending query gains its first DOM snapshot", () => {
    let state = reduceMarkdownFind(initialMarkdownFindState, {
      type: "query",
      query: "a",
      visibleOffset: 0,
    });
    state = reduceMarkdownFind(state, {
      type: "source",
      source: source("a a a", 4),
      offset: 4,
    });
    expect(state.activeIndex).toBe(2);
  });
  it("re-focuses on every open request and retains the query on close", () => {
    let state = reduceMarkdownFind(initialMarkdownFindState, {
      type: "query",
      query: "word",
      visibleOffset: 0,
    });
    state = reduceMarkdownFind(state, { type: "open" });
    state = reduceMarkdownFind(state, { type: "open" });
    expect(state.focusToken).toBe(2);
    state = reduceMarkdownFind(state, { type: "close" });
    expect(state.isOpen).toBe(false);
    expect(state.query).toBe("word");
  });
});
