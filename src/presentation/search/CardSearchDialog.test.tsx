import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import type { Board } from "../../domain/board.ts";
import type { Card } from "../../domain/card.ts";
import {
  type CardFilterCriteria,
  EMPTY_CARD_FILTER,
} from "../../domain/cardFilter.ts";
import { listRecentCardHits } from "../../domain/cardSearch.ts";
import { CardSearchDialog } from "./CardSearchDialog.tsx";
import type { CardSearchMode } from "./cardSearchModel.ts";

function makeCard(overrides: Partial<Card>): Card {
  return {
    path: "card.md",
    fileState: "available",
    labels: [],
    displayTitle: "Card",
    ...overrides,
  };
}

const current = makeCard({ path: "current.md", displayTitle: "Current card" });
const previous = makeCard({ path: "previous.md", displayTitle: "Previous" });
const missing = makeCard({
  path: "missing.md",
  displayTitle: "Missing card",
  fileState: "missing",
});

const board: Board = {
  version: 1,
  name: "Board",
  labels: [],
  columns: [
    { id: "todo", name: "Todo", cards: [current, previous] },
    { id: "done", name: "Done", cards: [missing] },
  ],
};

function render({
  mode = "search",
  board: shown = board,
  recentPaths = [],
  currentPath,
  criteria = EMPTY_CARD_FILTER,
}: {
  mode?: CardSearchMode;
  board?: Board;
  recentPaths?: string[];
  currentPath?: string;
  criteria?: CardFilterCriteria;
}): string {
  return renderToStaticMarkup(
    <CardSearchDialog
      mode={mode}
      board={shown}
      criteria={criteria}
      recent={listRecentCardHits(shown, recentPaths)}
      currentPath={currentPath}
      open
      onClose={() => {}}
      onSelect={() => {}}
    />,
  );
}

// Every option's opening tag, in document order, as id and attributes.
function options(output: string): { id: string; attributes: string }[] {
  return [...output.matchAll(/<div id="([^"]+)" role="option"([^>]*)>/g)].map(
    ([, id = "", attributes = ""]) => ({ id, attributes }),
  );
}

function activeDescendant(output: string): string | undefined {
  return /aria-activedescendant="([^"]+)"/.exec(output)?.[1];
}

const WITH_HISTORY = {
  recentPaths: ["current.md", "previous.md"],
  currentPath: "current.md",
};

describe("CardSearchDialog", () => {
  it("groups recent cards above all cards under labelled headings", () => {
    const output = render(WITH_HISTORY);

    expect(output).toContain(
      '<div role="group" aria-labelledby="card-search-recent-heading" class="card-search-dialog__group"><div id="card-search-recent-heading" role="presentation" class="card-search-dialog__group-heading">Recent</div>',
    );
    expect(output).toContain(
      '<div role="group" aria-labelledby="card-search-all-heading" class="card-search-dialog__group"><div id="card-search-all-heading" role="presentation" class="card-search-dialog__group-heading">All cards</div>',
    );
    expect(options(output).map(({ id }) => id)).toEqual([
      "card-search-recent-0",
      "card-search-recent-1",
      "card-search-all-0",
      "card-search-all-1",
      "card-search-all-2",
    ]);
  });

  it("disables the current card in Recent but not in All cards", () => {
    const output = render(WITH_HISTORY);
    const [recentCurrent, , allCurrent] = options(output);

    expect(recentCurrent?.attributes).toContain('aria-disabled="true"');
    expect(recentCurrent?.attributes).not.toContain("aria-selected");
    expect(allCurrent?.attributes).not.toContain("aria-disabled");
    expect(allCurrent?.attributes).toContain('aria-selected="false"');
    expect(output).toContain(
      '<span class="card-search-dialog__result-note">Current</span>',
    );
  });

  it("points the active descendant at the selected recent card", () => {
    const output = render(WITH_HISTORY);
    const selected = options(output).filter(({ attributes }) =>
      attributes.includes('aria-selected="true"'),
    );

    expect(activeDescendant(output)).toBe("card-search-recent-1");
    expect(selected.map(({ id }) => id)).toEqual(["card-search-recent-1"]);
  });

  it("gives every element its own id", () => {
    const output = render({
      recentPaths: ["current.md", "previous.md", "missing.md"],
      currentPath: "current.md",
    });
    const ids = [...output.matchAll(/ id="([^"]+)"/g)].map(([, id]) => id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("notes a missing card and one hidden by filters", () => {
    const output = render({
      recentPaths: ["missing.md"],
      criteria: { ...EMPTY_CARD_FILTER, hiddenColumnIds: new Set(["done"]) },
    });

    expect(output).toContain(
      '<span class="card-search-dialog__result-note card-search-dialog__result-note--missing">Missing</span><span class="card-search-dialog__result-note">Hidden by filters</span>',
    );
  });

  it("keeps the plain list without history", () => {
    const output = render({});

    expect(output).not.toContain('role="group"');
    expect(options(output).map(({ id }) => id)).toEqual([
      "card-search-results-0",
      "card-search-results-1",
      "card-search-results-2",
    ]);
    expect(activeDescendant(output)).toBe("card-search-results-0");
  });

  it("says nothing matches on an empty board", () => {
    const output = render({
      board: { ...board, columns: [] },
      recentPaths: ["current.md"],
    });

    expect(output).toContain("No cards match");
    expect(activeDescendant(output)).toBeUndefined();
  });
});

describe("CardSearchDialog in recent mode", () => {
  it("names the dialog and filter input without duplicating the heading", () => {
    const output = render({ ...WITH_HISTORY, mode: "recent" });

    expect(output).toContain('aria-labelledby="card-search-title"');
    expect(output).toContain(
      '<h2 id="card-search-title" class="card-search-dialog__title">Recent cards</h2>',
    );
    expect(output).toContain('aria-label="Filter recent cards"');
    expect(output).toContain('placeholder="Filter recent cards"');
    expect(output).not.toContain('role="group"');
    expect(output).not.toContain("All cards");
    expect(options(output).map(({ id }) => id)).toEqual([
      "card-search-recent-0",
      "card-search-recent-1",
    ]);
    expect(activeDescendant(output)).toBe("card-search-recent-1");
  });

  it("shows an empty history instead of all cards", () => {
    const output = render({ mode: "recent" });

    expect(output).toContain("No recent cards");
    expect(options(output)).toEqual([]);
    expect(activeDescendant(output)).toBeUndefined();
  });

  it("keeps the current-only row without an active descendant", () => {
    const output = render({
      mode: "recent",
      recentPaths: ["current.md"],
      currentPath: "current.md",
    });

    expect(options(output)).toHaveLength(1);
    expect(options(output)[0]?.attributes).toContain('aria-disabled="true"');
    expect(output).not.toContain("No recent cards");
    expect(activeDescendant(output)).toBeUndefined();
  });

  it("ignores history entries removed from the board", () => {
    const output = render({ mode: "recent", recentPaths: ["removed.md"] });

    expect(output).toContain("No recent cards");
    expect(options(output)).toEqual([]);
  });
});
