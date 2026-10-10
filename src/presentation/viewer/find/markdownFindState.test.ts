import { describe, expect, it } from "vitest";
import {
  initialMarkdownFindState,
  reduceMarkdownFind,
} from "./markdownFindState.ts";
import type { FindText } from "./findPresentation.ts";

function source(text: string, offset = 0): FindText {
  return { text, getAnchorOffset: () => offset };
}

describe("Markdown find state", () => {
  it("replaces the query with the selected text and anchors at that selection", () => {
    let state = reduceMarkdownFind(initialMarkdownFindState, {
      type: "source",
      source: source("one two one two"),
      offset: 0,
    });
    state = reduceMarkdownFind(state, { type: "query", query: "two" });
    state = reduceMarkdownFind(state, { type: "move", direction: 1 });
    state = reduceMarkdownFind(state, {
      type: "open",
      query: "one",
      offset: 8,
    });
    expect(state.isOpen).toBe(true);
    expect(state.query).toBe("one");
    expect(state.activeIndex).toBe(1);
    expect(state.ranges[state.activeIndex!]).toEqual({ start: 8, end: 11 });
    expect(state.focusToken).toBe(1);
    expect(state.revealToken).toBe(3);
  });

  it("retains the query and current match when opening without selected text", () => {
    let state = reduceMarkdownFind(initialMarkdownFindState, { type: "open" });
    state = reduceMarkdownFind(state, {
      type: "source",
      source: source("one one"),
      offset: 0,
    });
    state = reduceMarkdownFind(state, { type: "query", query: "one" });
    state = reduceMarkdownFind(state, { type: "move", direction: 1 });
    const revealToken = state.revealToken;
    state = reduceMarkdownFind(state, { type: "open" });
    expect(state.query).toBe("one");
    expect(state.activeIndex).toBe(1);
    expect(state.revealToken).toBe(revealToken);
  });

  it("discards offsets from the previous mode and starts at the new caret", () => {
    let state = reduceMarkdownFind(initialMarkdownFindState, { type: "open" });
    state = reduceMarkdownFind(state, {
      type: "source",
      source: source("one one"),
      offset: 0,
    });
    state = reduceMarkdownFind(state, { type: "query", query: "one" });
    const focusToken = state.focusToken;
    const revealToken = state.revealToken;
    state = reduceMarkdownFind(state, {
      type: "context",
      context: { cardPath: undefined, enabled: true, mode: "edit" },
    });
    expect(state.source).toBeUndefined();
    expect(state.ranges).toEqual([]);
    state = reduceMarkdownFind(state, {
      type: "source",
      source: source("**one** one"),
      offset: 8,
    });
    expect(state.isOpen).toBe(true);
    expect(state.query).toBe("one");
    expect(state.activeIndex).toBe(1);
    expect(state.focusToken).toBe(focusToken);
    expect(state.revealToken).toBe(revealToken);
  });

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
    let state = reduceMarkdownFind(initialMarkdownFindState, { type: "open" });
    state = reduceMarkdownFind(state, {
      type: "source",
      source: source("a   a"),
      offset: 0,
    });
    state = reduceMarkdownFind(state, {
      type: "query",
      query: "a",
      visibleOffset: 4,
    });
    const revealToken = state.revealToken;
    const replacement = source("a    a");
    state = reduceMarkdownFind(state, {
      type: "source",
      source: replacement,
      offset: 0,
    });
    expect(state.source).toBe(replacement);
    expect(state.activeIndex).toBe(1);
    expect(state.revealToken).toBe(revealToken);
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
    state = reduceMarkdownFind(state, {
      type: "context",
      context: { cardPath: "next.md", enabled: false, mode: "preview" },
    });
    state = reduceMarkdownFind(state, {
      type: "context",
      context: { cardPath: "next.md", enabled: true, mode: "preview" },
    });
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
    let state = reduceMarkdownFind(initialMarkdownFindState, { type: "open" });
    state = reduceMarkdownFind(state, {
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

  it("does not read source text for matching while the bar is closed", () => {
    let state = reduceMarkdownFind(initialMarkdownFindState, {
      type: "query",
      query: "word",
    });
    const unreadable: FindText = {
      get text(): string {
        throw new Error("Closed find must not inspect text for matching");
      },
      getAnchorOffset: () => 0,
    };
    state = reduceMarkdownFind(state, { type: "open" });
    state = reduceMarkdownFind(state, { type: "close" });
    state = reduceMarkdownFind(state, {
      type: "source",
      source: unreadable,
      offset: 0,
    });
    expect(state.source).toBe(unreadable);
    expect(state.query).toBe("word");
    expect(state.ranges).toEqual([]);
    expect(state.activeIndex).toBeUndefined();
  });

  it("matches the latest closed draft when reopened and uses the live caret", () => {
    let state = reduceMarkdownFind(initialMarkdownFindState, { type: "open" });
    state = reduceMarkdownFind(state, {
      type: "source",
      source: source("word"),
      offset: 0,
    });
    state = reduceMarkdownFind(state, { type: "query", query: "word" });
    state = reduceMarkdownFind(state, { type: "close" });
    const revealToken = state.revealToken;
    const replacement = source("new word word", 9);
    state = reduceMarkdownFind(state, {
      type: "source",
      source: replacement,
      offset: 9,
    });
    expect(state.ranges).toEqual([]);
    expect(state.revealToken).toBe(revealToken);
    state = reduceMarkdownFind(state, { type: "open", offset: 9 });
    expect(state.ranges).toEqual([{ start: 4, end: 8 }, { start: 9, end: 13 }]);
    expect(state.activeIndex).toBe(1);
    expect(state.source).toBe(replacement);
  });

  it("keeps a fresh source across an enabled context update", () => {
    let state = reduceMarkdownFind(initialMarkdownFindState, { type: "open" });
    state = reduceMarkdownFind(state, {
      type: "source",
      source: source("word word"),
      offset: 0,
    });
    state = reduceMarkdownFind(state, { type: "query", query: "word" });
    state = reduceMarkdownFind(state, {
      type: "context",
      context: { cardPath: undefined, enabled: true, mode: "preview" },
    });
    expect(state.source?.text).toBe("word word");
    expect(state.ranges).toHaveLength(2);
  });
});
